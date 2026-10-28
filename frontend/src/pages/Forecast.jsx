import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisMoney, mgrOk, forecast, growthOf, money, pct, prettyCountry, prettyName, scope, signedPct } from '../data.js'
import { Card, Insight, Kpi } from '../ui.jsx'

const STATUS = ['Approved - not dispatched', 'Approved - partly dispatched', 'Awaiting approval']
const STATUS_COLOR = { 'Approved - not dispatched': '#1f4fc4', 'Approved - partly dispatched': '#12a39a', 'Awaiting approval': '#f4b942' }
const AGES = [['0–30 days', 0, 30], ['31–60', 31, 60], ['61–90', 61, 90], ['91–180', 91, 180], ['181–365', 181, 365], ['365+', 366, 1e9]]

export default function Forecast({ sc, d, f }) {
  const { cur, lastRate, table } = sc
  const fmt = (v) => money(v, cur)
  const fc = forecast(sc)

  // landing by region (each region forecast on its own growth)
  const regions = useMemo(() => table('region').map((g) => {
    const r = forecast(scope(d, { ...f, region: g.name }))
    return { name: g.name, ytd: r.actual, landing: r.landing, target: r.fyTarget, pctT: r.fyTarget ? r.landing / r.fyTarget : null, growth: r.growth }
  }), [sc])

  // open export orders (Odoo), converted at the latest USD rate
  const today = new Date(d.meta.last_invoice || Date.now())
  const orders = d.orders
    .filter((o) => (f.region === 'All' || o.region === f.region) && (f.country === 'All' || o.country === f.country) && mgrOk(d, f, o.country))
    .map((o) => ({ ...o, v: cur === 'INR' ? o.pending_inr : o.pending_inr / lastRate, age: Math.max(0, Math.round((today - new Date(o.order_date)) / 864e5)) }))
  const openTotal = orders.reduce((a, o) => a + o.v, 0)
  const orderCount = new Set(orders.map((o) => o.order_no)).size
  const byStatus = STATUS.map((s) => ({ s, v: orders.filter((o) => o.status === s).reduce((a, o) => a + o.v, 0) }))
  const byAge = AGES.map(([label, a, b]) => {
    const row = { label }
    STATUS.forEach((s) => { row[s] = orders.filter((o) => o.status === s && o.age >= a && o.age <= b).reduce((x, o) => x + o.v, 0) })
    return row
  })
  const byCountry = (() => {
    const m = new Map()
    orders.forEach((o) => m.set(o.country, (m.get(o.country) || 0) + o.v))
    return [...m.entries()].map(([name, v]) => ({ name: prettyCountry(name), v })).sort((a, b) => b.v - a.v).slice(0, 10)
  })()
  const largest = (() => {
    const m = new Map()
    orders.forEach((o) => {
      const g = m.get(o.order_no) || { ...o, v: 0, segs: new Set() }
      g.v += o.v; g.segs.add(prettyName(o.segment)); m.set(o.order_no, g)
    })
    return [...m.values()].sort((a, b) => b.v - a.v).slice(0, 15)
  })()
  const old = orders.filter((o) => o.age > 180).reduce((a, o) => a + o.v, 0)
  const toTarget = fc.fyTarget ? Math.max(0, fc.fyTarget - fc.actual) : null
  const cover = toTarget ? openTotal / toTarget : null

  return (
    <>
      <div className="kpis k5">
        <Kpi icon="sales" title="Billed YTD" value={fmt(fc.actual)} foot={<>run-rate {fmt(fc.runRate)} / month</>} />
        <Kpi icon="growth" title="Full-year landing" value={fmt(fc.landing)} foot={<>at this year's growth ({signedPct(fc.growth)})</>} />
        <Kpi icon="target" title="Full-year target" value={fc.fyTarget ? fmt(fc.fyTarget) : '–'}
          foot={fc.fyTarget ? <>landing {pct(fc.landing / fc.fyTarget, 0)} of target</> : <span className="muted">Target not loaded</span>}
          tone={fc.fyTarget ? (fc.landing >= fc.fyTarget ? 'up' : 'down') : ''} />
        <Kpi icon="chart" title="Needed per month" value={fc.needed != null ? fmt(fc.needed) : '–'}
          foot={fc.needed != null ? <>to reach target in {fc.left} months · now {fmt(fc.runRate)}</> : 'no target or year closed'} />
        <Kpi icon="box" title="Open export orders" value={fmt(openTotal)} foot={<>{orderCount} orders{cover != null ? ` · ${pct(cover, 0)} of the gap to target` : ''}</>} />
      </div>

      <div className="grid g-7-5">
        <Card title="Cumulative sales – actual, forecast and target" sub={`(${cur})`}>
          <div className="chart" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={fc.months} margin={{ top: 8, right: 8 }}>
                <CartesianGrid stroke="#e7ecf3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={axisMoney(cur)} tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => money(v, cur)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="cumActual" name="Actual" stroke="#1f4fc4" strokeWidth={2.6} dot={{ r: 3 }} isAnimationActive={false} />
                <Line dataKey="cumForecast" name="Forecast" stroke="#1f4fc4" strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="cumTarget" name="Target" stroke="#f07b21" strokeDasharray="2 3" strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Insight>Forecast = billed to date + last year's remaining months grown at this year's YTD growth.
            {fc.gap != null && fc.gap > 0 && <> At this pace the year lands {fmt(fc.gap)} short of target; closing it needs {fmt(fc.needed)} a month against {fmt(fc.runRate)} today.</>}
            {fc.gap != null && fc.gap <= 0 && <> At this pace the year lands {fmt(-fc.gap)} above target.</>}</Insight>
        </Card>
        <Card title="Landing by region">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Region</th><th>YTD</th><th>Landing</th><th>FY target</th><th>Landing %</th><th>Growth</th></tr></thead>
              <tbody>
                {regions.map((r) => (
                  <tr key={r.name}><td>{prettyName(r.name)}</td><td>{fmt(r.ytd)}</td><td>{fmt(r.landing)}</td><td>{r.target ? fmt(r.target) : '–'}</td>
                    <td className={r.pctT == null ? '' : r.pctT >= 1 ? 'up' : r.pctT >= 0.9 ? 'warnc' : 'down'}>{r.pctT == null ? '–' : pct(r.pctT, 0)}</td>
                    <td className={r.growth == null ? '' : r.growth >= 0 ? 'up' : 'down'}>{r.growth == null ? '–' : signedPct(r.growth)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <h3 className="section-h">Open export orders <small>Odoo sale orders not yet fully invoiced · {orderCount} orders · {fmt(openTotal)}</small></h3>
      {d.ordersError && <div className="banner err">Open orders could not be read: {d.ordersError}</div>}
      <div className="grid g-4-4-4">
        <Card title="By status">
          <div className="status-bars">
            {byStatus.map((s) => (
              <div key={s.s} className="sbar"><span>{s.s}</span><i><i style={{ width: `${openTotal ? (s.v / openTotal) * 100 : 0}%`, background: STATUS_COLOR[s.s] }} /></i><b>{fmt(s.v)}</b></div>
            ))}
          </div>
          <Insight>{old > 0 && <>{fmt(old)} ({pct(openTotal ? old / openTotal : 0, 0)}) is older than 180 days – worth confirming these are still live.</>}</Insight>
        </Card>
        <Card title="By age and status" sub={`(${cur})`}>
          <div className="chart" style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byAge} margin={{ top: 8, right: 8 }}>
                <CartesianGrid stroke="#e7ecf3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10.5 }} />
                <YAxis tickFormatter={axisMoney(cur)} tick={{ fontSize: 11 }} width={56} />
                <Tooltip formatter={(v) => money(v, cur)} />
                {STATUS.map((s) => <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLOR[s]} isAnimationActive={false} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Top countries by open orders">
          <div className="chart" style={{ height: Math.max(200, byCountry.length * 24 + 30) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCountry} layout="vertical" margin={{ left: 4, right: 12 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => money(v, cur)} />
                <Bar dataKey="v" name="Open orders" fill="#1f4fc4" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Largest open export orders">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Order</th><th>Date</th><th>Age (days)</th><th>Customer</th><th>Country</th><th>Status</th><th>Segments</th><th>To invoice</th></tr></thead>
            <tbody>
              {largest.map((o) => (
                <tr key={o.order_no}><td>{o.order_no}</td><td>{o.order_date}</td><td className={o.age > 180 ? 'down' : ''}>{o.age}</td>
                  <td className="l">{prettyName(o.customer || '')}</td><td className="l">{prettyCountry(o.country)}</td>
                  <td className="l"><i className="dot" style={{ background: STATUS_COLOR[o.status] }} /> {o.status}</td>
                  <td className="l muted">{[...o.segs].join(', ')}</td><td>{fmt(o.v)}</td></tr>
              ))}
              {!largest.length && <tr><td colSpan={8} className="muted">No open export orders in this selection</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
