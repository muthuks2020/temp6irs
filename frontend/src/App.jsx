import { useEffect, useMemo, useState } from 'react'
import { MONTHS, managersOf, countriesOf, defaultAsOf, fyLabel, prepare, prettyCountry, prettyName, regionsOf, scope, summarise } from './data.js'
import { Icon } from './ui.jsx'
import Summary from './pages/Summary.jsx'
import Product from './pages/Product.jsx'
import Regional from './pages/Regional.jsx'
import Country from './pages/Country.jsx'
import Brands from './pages/Brands.jsx'
import Forecast from './pages/Forecast.jsx'

const PAGES = [
  ['summary', 'home', 'Executive Summary'], ['product', 'box', 'Product Performance'], ['regional', 'globe', 'Regional Performance'],
  ['country', 'pin', 'Country Performance'], ['brands', 'star', 'Brands Performance'], ['forecast', 'chart', 'Forecast & Pipeline'],
]
const pageFromHash = () => { const h = window.location.hash.replace('#', ''); return PAGES.some((p) => p[0] === h) ? h : 'summary' }

export default function App() {
  const [fy, setFy] = useState(null)
  const [raw, setRaw] = useState(null)
  const [state, setState] = useState({ state: 'loading' })
  const [f, setF] = useState({ asof: null, region: 'All', manager: 'All', country: 'All', currency: 'USD' })
  const [navOpen, setNavOpen] = useState(false)
  const [page, setPage] = useState(pageFromHash)
  useEffect(() => {
    const on = () => setPage(pageFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = (p) => { window.location.hash = p; setNavOpen(false); window.scrollTo(0, 0) }

  const load = (want, refresh = false) => {
    let stop = false
    const poll = async (first) => {
      try {
        const q = new URLSearchParams()
        if (want) q.set('fy', want)
        if (refresh && first) q.set('refresh', 'true')
        const r = await fetch(`/api/bundle?${q}`)
        const j = await r.json()
        if (stop) return
        if (j.state === 'ok') {
          setRaw(prepare(j)); setState({ state: 'ok' }); setFy(j.meta.fy)
        } else if (j.state === 'error') setState(j)
        else { setState(j); setTimeout(() => poll(false), 2000) }
      } catch (e) {
        if (!stop) { setState({ state: 'error', error: String(e) }); }
      }
    }
    poll(true)
    return () => { stop = true }
  }
  useEffect(() => load(null), [])

  useEffect(() => { if (raw) setF((x) => ({ ...x, asof: defaultAsOf(raw) })) }, [raw])

  const regions = useMemo(() => (raw ? regionsOf(raw) : []), [raw])
  const managers = useMemo(() => (raw ? managersOf(raw, f.region) : []), [raw, f.region])
  const countries = useMemo(() => (raw ? countriesOf(raw, f.region, f.manager) : []), [raw, f.region, f.manager])
  const s = useMemo(() => (raw && f.asof && page === 'summary' ? summarise(raw, f) : null), [raw, f, page])
  const sc = useMemo(() => (raw && f.asof ? scope(raw, f) : null), [raw, f])
  const pageLabel = PAGES.find((p) => p[0] === page)[2]

  const pickFy = (v) => { setF((x) => ({ ...x, asof: null })); setRaw(null); setState({ state: 'loading' }); load(v) }
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value, ...(k === 'region' ? { country: 'All', manager: 'All' } : k === 'manager' ? { country: 'All' } : {}) }))
  const meta = raw?.meta
  const maxM = meta ? (meta.cut_m || 12) : 12
  const asofDate = meta && f.asof ? asOfText(meta, f.asof) : ''

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo-chip"><img src="/appasamy-logo.png" alt="Appasamy Associates – Empowering Vision" /></span>
          <button className="menu-btn" onClick={() => setNavOpen((o) => !o)} aria-label="Menu">☰</button>
        </div>
        <div className="title">
          <h1>Iris International</h1>
          <p>International Business · {pageLabel}</p>
        </div>
        <div className="filters">
          <label>Fiscal year
            <select value={fy || ''} onChange={(e) => pickFy(e.target.value)}>
              {(meta?.fiscal_years || (fy ? [fy] : [])).map((y) => <option key={y} value={y}>{fyLabel(y)}</option>)}
            </select></label>
          <label>As of
            <select value={f.asof || ''} onChange={(e) => setF((x) => ({ ...x, asof: +e.target.value }))}>
              {MONTHS.slice(0, maxM).map((m, i) => <option key={m} value={i + 1}>{meta ? asOfText(meta, i + 1) : m}</option>)}
            </select></label>
          <label>Region
            <select value={f.region} onChange={set('region')}>
              <option>All</option>{regions.map((r) => <option key={r} value={r}>{prettyName(r)}</option>)}
            </select></label>
          <label>Manager
            <select value={f.manager} onChange={set('manager')}>
              <option>All</option>{managers.map((m) => <option key={m} value={m}>{prettyName(m)}</option>)}
            </select></label>
          <label>Country
            <select value={f.country} onChange={set('country')}>
              <option>All</option>{countries.map((c) => <option key={c} value={c}>{prettyCountry(c)}</option>)}
            </select></label>
          <label>Currency
            <select value={f.currency} onChange={set('currency')}><option>USD</option><option>INR</option></select></label>
          <span className="cur-note">All values in {f.currency}</span>
        </div>
      </header>

      <div className="layout">
        <nav className={`side ${navOpen ? 'open' : ''}`}>
          {PAGES.map(([key, ic, label]) => (
            <a key={key} href={`#${key}`} className={page === key ? 'on' : ''} onClick={(e) => { e.preventDefault(); go(key) }}>
              <Icon n={ic} size={26} /><span>{label}</span>
            </a>
          ))}
          <div className="side-foot">
            <div className="side-box"><span>Data as of</span><b>{meta?.last_invoice ? fmtDate(meta.last_invoice) : '–'}</b></div>
            <button className="side-box refresh" onClick={() => { setRaw(null); setState({ state: 'loading' }); load(fy, true) }}>
              <Icon n="refresh" size={20} /><span>Refreshed<b>{meta ? fmtDateTime(meta.generated_at) : '–'}</b></span>
            </button>
          </div>
        </nav>

        <main>
          {meta?.mode === 'demo' && <div className="banner">SAMPLE DATA – every figure and name on this page is invented for testing. Set demo_mode = false in backend\config\database.ini and restart.</div>}
          {state.state === 'error' && <div className="banner err">Could not load: {state.error}</div>}
          {!sc && state.state !== 'error' && <div className="loading"><span className="spin" />Loading international sales{state.seconds ? ` (${state.seconds} s)` : ''}…</div>}
          {sc && page === 'summary' && s && <Summary s={s} cur={f.currency} f={f} setF={setF} asofDate={asofDate} />}
          {sc && page !== 'summary' && <div className="context">{fyLabel(sc.fy)} YTD to {asofDate}{sc.open ? ' (open month compared with the same days last year)' : ''}
            {f.region !== 'All' && <> · Region <b>{prettyName(f.region)}</b></>}{f.manager !== 'All' && <> · Manager <b>{prettyName(f.manager)}</b></>}{f.country !== 'All' && <> · Country <b>{prettyCountry(f.country)}</b></>}</div>}
          {sc && page === 'product' && <Product sc={sc} />}
          {sc && page === 'regional' && <Regional sc={sc} d={raw} f={f} setF={setF} go={go} />}
          {sc && page === 'country' && <Country sc={sc} d={raw} f={f} setF={setF} />}
          {sc && page === 'brands' && <Brands sc={sc} />}
          {sc && page === 'forecast' && <Forecast sc={sc} d={raw} f={f} />}
          {sc && page !== 'summary' && <footer className="foot"><span>Sales = invoiced export lines net of credit notes · USD from the invoice currency, others at that month's average USD rate</span>
            <span>Source: gold.vw_sales_extract_export_ganit_dashboard · targets: silver_static.export_target{page === 'forecast' ? ' · open orders: Odoo sale orders' : ''}</span></footer>}
          {sc && <PageNav page={page} go={go} />}
        </main>
      </div>
    </div>
  )
}

function fmtDate(iso) {
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function asOfText(meta, m) {
  const start = 2000 + +meta.fy.slice(2, 4)
  const cal = m <= 9 ? m + 3 : m - 9
  const year = m <= 9 ? start : start + 1
  if (meta.cut_m && m === meta.cut_m && meta.last_invoice) return fmtDate(meta.last_invoice)
  const last = new Date(year, cal, 0)
  return last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PageNav({ page, go }) {
  const i = PAGES.findIndex((p) => p[0] === page)
  const prev = PAGES[i - 1], next = PAGES[i + 1]
  return (
    <div className="pagenav">
      {prev ? <button onClick={() => go(prev[0])}>← {prev[2]}</button> : <span />}
      {next ? <button onClick={() => go(next[0])}>{next[2]} →</button> : <span />}
    </div>
  )
}
