"""Iris International – export business dashboard API (FastAPI). Separate project from Iris.

Run (from the backend folder):
    .\\.venv\\Scripts\\python.exe run.py          -> http://localhost:8020

How it works
  * ONE read of the export view per refresh: the invoice lines are copied into a TEMP table
    for this session only (dropped at commit), then 5 small aggregate queries run on it.
  * The browser gets one compact "bundle" per fiscal year and does every filter
    (as-of month, region, country, currency) itself, so filter changes are instant.
  * Read-only: only SELECT on gold / silver_static; nothing is created outside the session.
  * Results are cached in memory (cache_ttl_minutes) and pre-loaded in the background.
"""
import datetime as dt
import threading
import time
from decimal import Decimal
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import PlainTextResponse

from . import demo
from .config import CONFIG_FILE, load_settings

settings = load_settings()
LIVE = not settings.demo_mode
SQL = Path(__file__).resolve().parents[1] / "sql"
app = FastAPI(title="Iris International API", version="1.0")
app.add_middleware(GZipMiddleware, minimum_size=2000)

_pool = None
_pool_lock = threading.Lock()
_cache = {}            # fy -> {"t": epoch, "data": bundle}
_jobs = {}             # fy -> {"state", "error", "started"}
_jobs_lock = threading.Lock()
_export = {"obj": None, "checked": False}


def log(msg):
    print(f"[intl] {dt.datetime.now():%H:%M:%S} {msg}", flush=True)


def pool():
    global _pool
    with _pool_lock:
        if _pool is None:
            from psycopg_pool import ConnectionPool
            _pool = ConnectionPool(settings.conninfo, min_size=1, max_size=max(2, settings.pool_max), open=True,
                                   check=ConnectionPool.check_connection, max_idle=300, timeout=60)
        return _pool


# ---------------------------------------------------------------------------- fiscal helpers
def fiscal_year(d: dt.date) -> str:
    s = d.year if d.month >= 4 else d.year - 1
    return f"FY{s % 100:02d}_{(s + 1) % 100:02d}"


def prev_fy(fy: str) -> str:
    a = int(fy[2:4]) - 1
    return f"FY{a % 100:02d}_{(a + 1) % 100:02d}"


def _clean(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (dt.date, dt.datetime)):
        return v.isoformat()
    return v


# ---------------------------------------------------------------------------- SQL assembly
def _read(rel):
    return (SQL / rel).read_text(encoding="utf-8")


def export_source() -> str:
    """The export view if it exists (SELECT only), else its own SQL logic inline."""
    if not LIVE:
        return settings.export_object
    if not _export["checked"]:
        obj = settings.export_object
        schema, _, name = obj.partition(".")
        try:
            with pool().connection() as conn, conn.cursor() as cur:
                cur.execute("""SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                               WHERE n.nspname = %s AND c.relname = %s AND has_table_privilege(c.oid, 'SELECT')""",
                            (schema, name))
                _export["obj"] = obj if cur.fetchone() else None
        except Exception as e:  # noqa: BLE001
            log(f"export view check failed: {e}")
            _export["obj"] = None
        _export["checked"] = True
        log(f"export source: {_export['obj'] or 'computed from sql/sources/vw_sales_extract_export_ganit_dashboard.sql'}")
    if _export["obj"]:
        return _export["obj"]
    return "(\n" + _read("sources/vw_sales_extract_export_ganit_dashboard.sql") + "\n)"


def base_sql(name: str) -> str:
    return _read(name).replace("{{export}}", export_source())


def statements(params: dict, temp: bool) -> dict:
    """The five data statements, either on TEMP tables or as self-contained CTE queries."""
    out = {}
    for key in ("meta", "cube", "targets", "customers", "rates", "countries"):
        body = _read("meta.sql" if key == "meta" else f"data/{key}.sql")
        if not temp:
            lines = base_sql("intl_lines.sql").replace("%", "%%")
            tgts = base_sql("intl_targets.sql").replace("%", "%%")
            body = f"WITH intl_lines AS (\n{lines}\n), intl_targets AS (\n{tgts}\n)\n{body}"
        out[key] = body
    return out


def _rows(cur):
    return {"cols": [c.name for c in cur.description], "rows": [[_clean(v) for v in r] for r in cur.fetchall()]}


def compute(fy: str) -> dict:
    t0 = time.time()
    p = {"fy": fy, "prev_fy": prev_fy(fy), "prev2_fy": prev_fy(prev_fy(fy)), "cut_day": 31, "cut_m": 0}
    out = {}
    with pool().connection() as conn:
        temp = settings.use_temp_tables
        if temp:
            try:
                with conn.transaction(), conn.cursor() as cur:
                    cur.execute("CREATE TEMP TABLE intl_lines ON COMMIT DROP AS " + base_sql("intl_lines.sql"))
                    cur.execute("CREATE TEMP TABLE intl_targets ON COMMIT DROP AS " + base_sql("intl_targets.sql"))
                    out = _run(cur, p, statements(p, True))
            except Exception as e:  # noqa: BLE001  - no TEMP privilege -> self-contained queries
                if "permission" not in str(e).lower() and "temp" not in str(e).lower():
                    raise
                log(f"temp tables not allowed ({e}); using CTE queries")
                temp = False
        if not temp:
            with conn.transaction(), conn.cursor() as cur:
                out = _run(cur, p, statements(p, False))
    last = out["meta"]["rows"][0][0] if out["meta"]["rows"] else None
    out["meta"] = {"mode": "live", "fy": fy, "prev_fy": p["prev_fy"], "prev2_fy": p["prev2_fy"],
                   "last_invoice": last, "cut_day": p["cut_day"], "cut_m": p["cut_m"],
                   "fiscal_years": (out["meta"]["rows"][0][1] if out["meta"]["rows"] else None) or [fy],
                   "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
                   "seconds": round(time.time() - t0, 1)}
    log(f"{fy} refreshed in {out['meta']['seconds']} s, {len(out['cube']['rows'])} cube rows")
    return out


def _run(cur, p, st):
    out = {}
    cur.execute(st["meta"], p)
    out["meta"] = _rows(cur)
    last = out["meta"]["rows"][0][0] if out["meta"]["rows"] else None
    if last:
        last_d = dt.date.fromisoformat(str(last)[:10])
        if fiscal_year(last_d) == p["fy"]:
            p["cut_day"] = last_d.day
            p["cut_m"] = ((last_d.month + 8) % 12) + 1
    for key in ("cube", "targets", "customers", "rates", "countries"):
        cur.execute(st[key], p)
        out[key] = _rows(cur)
    # open export orders come straight from Odoo (silver); optional - a failure here never blocks the page
    try:
        with cur.connection.transaction():
            cur.execute(_read("orders.sql"))
            out["orders"] = _rows(cur)
    except Exception as e:  # noqa: BLE001
        log(f"open orders not available: {e}")
        out["orders"] = {"cols": [], "rows": [], "error": str(e)[:300]}
    return out


# ---------------------------------------------------------------------------- jobs + cache
def current_fy() -> str:
    return fiscal_year(dt.date.today() - dt.timedelta(days=1))


def _job(fy):
    try:
        data = demo.bundle(fy) if not LIVE else compute(fy)
        _cache[fy] = {"t": time.time(), "data": data}
        _jobs[fy] = {"state": "ok"}
    except Exception as e:  # noqa: BLE001
        log(f"{fy} failed: {e}")
        _jobs[fy] = {"state": "error", "error": str(e)[:600]}


def start(fy, force=False):
    with _jobs_lock:
        if _jobs.get(fy, {}).get("state") == "running":
            return
        hit = _cache.get(fy)
        if hit and not force and time.time() - hit["t"] < settings.cache_ttl_min * 60:
            return
        _jobs[fy] = {"state": "running", "started": time.time()}
    threading.Thread(target=_job, args=(fy,), daemon=True).start()


@app.get("/api/bundle")
def bundle(fy: str = Query(None, pattern=r"^FY\d{2}_\d{2}$"), refresh: bool = False):
    fy = fy or current_fy()
    hit = _cache.get(fy)
    fresh = hit and time.time() - hit["t"] < settings.cache_ttl_min * 60
    if refresh or not fresh:
        start(fy, force=refresh)
    if hit and not refresh:
        return {"state": "ok", **hit["data"]}
    job = _jobs.get(fy, {})
    if job.get("state") == "error":
        return {"state": "error", "error": job.get("error")}
    if job.get("state") == "ok" and fy in _cache:
        return {"state": "ok", **_cache[fy]["data"]}
    return {"state": "running", "seconds": round(time.time() - job.get("started", time.time()))}


@app.get("/api/health")
def health():
    return {"mode": "live" if LIVE else "demo", "config_file": str(CONFIG_FILE), "export_object": settings.export_object,
            "cached": {k: dt.datetime.fromtimestamp(v["t"]).isoformat(timespec="seconds") for k, v in _cache.items()}}


@app.get("/api/sql", response_class=PlainTextResponse)
def show_sql():
    """Every statement one refresh runs – paste into DBeaver / psql to check a number."""
    p = "-- parameters: fy, prev_fy, prev2_fy, cut_day, cut_m\n"
    st = statements({}, temp=False)
    st["orders"] = _read("orders.sql")
    return p + "\n\n".join(f"-- ===== {k} =====\n{v};" for k, v in st.items())


def _background():
    while True:
        try:
            start(current_fy(), force=True)
        except Exception as e:  # noqa: BLE001
            log(f"background: {e}")
        time.sleep(max(5, settings.cache_ttl_min) * 60)


@app.on_event("startup")
def _startup():
    log(f"mode={'live' if LIVE else 'demo'}  config={CONFIG_FILE}")
    if settings.background_refresh:
        threading.Thread(target=_background, daemon=True, name="intl-refresh").start()


_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _DIST.exists():
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="frontend")
