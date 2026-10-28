"""Loads backend/config/database.ini (+ INTL_DB_* environment overrides).

Iris International has its own settings file and its own environment variables,
so it can never pick up, or change, the settings of the Iris group dashboard.
"""
import configparser
import os
from dataclasses import dataclass
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parents[1] / "config"
CONFIG_FILE = Path(os.environ.get("INTL_CONFIG_FILE", CONFIG_DIR / "database.ini"))


def _bool(v, default=False):
    if v is None or str(v).strip() == "":
        return default
    return str(v).strip().lower() in ("1", "true", "yes", "on")


@dataclass
class Settings:
    host: str
    port: int
    dbname: str
    user: str
    password: str
    sslmode: str
    search_path: str
    pool_max: int
    demo_mode: bool
    statement_timeout_s: int
    cache_ttl_min: int
    background_refresh: bool
    use_temp_tables: bool
    export_object: str
    server_host: str
    server_port: int

    @property
    def conninfo(self) -> str:
        from psycopg.conninfo import make_conninfo
        return make_conninfo(
            host=self.host, port=self.port, dbname=self.dbname, user=self.user, password=self.password,
            sslmode=self.sslmode, application_name="iris_international", connect_timeout=20,
            keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=6,
            options=f"-c search_path={self.search_path} -c statement_timeout={self.statement_timeout_s * 1000}",
        )


def load_settings() -> Settings:
    cp = configparser.ConfigParser(inline_comment_prefixes=(";", "#"))
    if CONFIG_FILE.exists():
        cp.read(CONFIG_FILE, encoding="utf-8")
    pg = cp["postgres"] if cp.has_section("postgres") else {}
    ap = cp["app"] if cp.has_section("app") else {}
    sv = cp["server"] if cp.has_section("server") else {}

    def g(env, key, default=""):
        return os.environ.get(env) or pg.get(key, default) or default

    return Settings(
        host=g("INTL_DB_HOST", "host").strip(),
        port=int(g("INTL_DB_PORT", "port", "5432")),
        dbname=g("INTL_DB_NAME", "dbname"),
        user=g("INTL_DB_USER", "user"),
        password=g("INTL_DB_PASSWORD", "password"),
        sslmode=g("INTL_DB_SSLMODE", "sslmode", "prefer"),
        search_path=pg.get("search_path", "gold,silver,silver_static,public"),
        pool_max=int(pg.get("pool_max", 3)),
        demo_mode=_bool(ap.get("demo_mode"), False),
        statement_timeout_s=int(ap.get("statement_timeout_seconds", 600)),
        cache_ttl_min=int(ap.get("cache_ttl_minutes", 60)),
        background_refresh=_bool(ap.get("background_refresh"), True),
        use_temp_tables=_bool(ap.get("use_temp_tables"), True),
        export_object=str(ap.get("export_object", "gold.vw_sales_extract_export_ganit_dashboard")).strip(),
        server_host=str(sv.get("host", "127.0.0.1")).strip(),
        server_port=int(sv.get("port", 8020)),
    )
