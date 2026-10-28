import { ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import WorldMap from '../WorldMap.jsx'
import { fyLabel, money, pct, prettyCountry, prettyName, signedPct } from '../data.js'
import { Arrow, Card, Donut, EQ_COLORS, Kpi, MIX_COLORS, achClass } from '../ui.jsx'

function RegionTable({ rows, cur, hasTargets }) {
  const tot = rows.reduce((a, r) => ({ v: a.v + r.v, py: a.py + r.py, target: a.target + r.target }), { v: 0, py: 0, target: 0 })
  return (
    <Card title="Regional performance summary" className="region-card">
      <div className="tbl-wrap">
        <table className="tbl head-dark">
          <thead><tr><th>Region</th><th>Sales</th><th>vs PY</th><th>Growth %</th><th>Target</th><th>Ach %</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name}>
                <td><span className="rank">{i + 1}.</span>{prettyName(r.name)}</td>
                <td>{money(r.v, cur)}</td><td>{money(r.py, cur)}</td>
                <td className={r.growth == null ? '' : r.growth >= 0 ? 'up' : 'down'}>{r.growth == null ? 'new' : signedPct(r.growth)}</td>
                <td>{r.target ? money(r.target, cur) : '–'}</td>
                <td>{r.ach == null ? '–' : <>{pct(r.ach)} <i className={`dot ${achClass(r.ach)}`} /></>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td>{money(tot.v, cur)}</td><td>{money(tot.py, cur)}</td>
            <td>{tot.py ? signedPct(tot.v / tot.py - 1) : '–'}</td><td>{tot.target ? money(tot.target, cur) : '–'}</td>
            <td>{tot.target ? pct(tot.v / tot.target) : '–'}</td></tr></tfoot>
        </table>
      </div>
      {!hasTargets && <p className="note">Targets are not loaded for this year yet; Ach % will fill in once they are.</p>}
    </Card>
  )
}

function TrendCard({ trend, cur }) {
  const fmt = (v) => money(v, cur, 0)
  return (
    <Card title="Sales trend" sub={`(${cur})`} className="trend-card">
      <div className="trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e7ecf3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5a6780' }} tickLine={false} axisLine={{ stroke: '#c9d3e1' }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#5a6780' }} width={56} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => money(v, cur)} />
            <Legend verticalAlign="top" height={26} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
            <Line name="Actual" dataKey="actual" stroke="#1f4fc4" strokeWidth={2.5} dot={{ r: 3.5 }} connectNulls={false} isAnimationActive={false} />
            <Line name="PY" dataKey="py" stroke="#9aa6b8" strokeDasharray="6 4" strokeWidth={1.8} dot={false} isAnimationActive={false} />
            <Line name="Target" dataKey="target" stroke="#3d8bfd" strokeDasharray="2 3" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function TopCountries({ rows, cur, onPick }) {
  const top = rows.filter((r) => r.v > 0).slice(0, 10)
  const max = Math.max(1, ...top.map((r) => r.v))
  return (
    <Card title="Top 10 countries by sales" sub="(YTD)">
      <div className="tbl-wrap">
        <table className="tbl ctry">
          <thead><tr><th /><th>Country</th><th>Sales</th><th>vs PY</th><th>Growth %</th><th>Ach %</th></tr></thead>
          <tbody>
            {top.map((r, i) => (
              <tr key={r.name} onClick={() => onPick(r.name)} className="click">
                <td className="rank">{i + 1}</td><td>{prettyCountry(r.name)}</td>
                <td className="barcell"><span className="bar" style={{ width: `${Math.max(2, (r.v / max) * 46)}px` }} /><span>{money(r.v, cur)}</span></td>
                <td>{money(r.py, cur)}</td>
                <td className={r.growth == null ? '' : r.growth >= 0 ? 'up' : 'down'}>{r.growth == null ? 'new' : signedPct(r.growth)}</td>
                <td className={`ach ${achClass(r.ach)}`}>{r.ach == null ? '–' : pct(r.ach, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Brands({ title, rows, cur, totalLabel }) {
  const tot = rows.reduce((a, r) => ({ v: a.v + r.v, py: a.py + r.py }), { v: 0, py: 0 })
  return (
    <Card title={title}>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Brand</th><th>Sales</th><th>vs PY</th><th>Growth %</th><th>Mix %</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}><td>{prettyName(r.name)}</td><td>{money(r.v, cur)}</td><td>{money(r.py, cur)}</td>
                <td className={r.growth == null ? '' : r.growth >= 0 ? 'up' : 'down'}>{r.growth == null ? 'new' : signedPct(r.growth)}</td><td>{pct(r.share)}</td></tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="muted">No sales in this selection</td></tr>}
          </tbody>
          <tfoot><tr><td>{totalLabel}</td><td>{money(tot.v, cur)}</td><td>{money(tot.py, cur)}</td>
            <td>{tot.py ? signedPct(tot.v / tot.py - 1) : '–'}</td><td>{rows.length ? '100%' : '–'}</td></tr></tfoot>
        </table>
      </div>
    </Card>
  )
}

export default function Summary({ s, cur, f, setF, asofDate }) {
  const t = s.tiles
  const pick = (c) => setF((x) => ({ ...x, country: x.country === c ? 'All' : c }))
  return (
    <>
      <div className="context">
        {fyLabel(s.fy)} YTD to {asofDate}{s.open ? ' (open month compared with the same days last year)' : ''}
        {f.region !== 'All' && <> · Region <b>{prettyName(f.region)}</b></>}
        {f.manager !== 'All' && <> · Manager <b>{prettyName(f.manager)}</b></>}
        {f.country !== 'All' && <> · Country <b>{prettyCountry(f.country)}</b> <button className="chip" onClick={() => pick(f.country)}>clear</button></>}
      </div>
      <div className="kpis">
        <Kpi icon="sales" title="Net sales (YTD)" value={money(t.net, cur)} foot={<>vs PY {money(t.netPy, cur)} <Arrow v={t.growth} /></>} />
        <Kpi icon="growth" title="Growth vs PY" value={signedPct(t.growth)} tone={t.growth >= 0 ? 'up' : 'down'}
          foot={<>vs PY {signedPct(t.growthPy)} <Arrow v={t.growth != null && t.growthPy != null ? t.growth - t.growthPy : null} pp /></>} />
        <Kpi icon="target" title="Target achievement" value={t.ach == null ? '–' : pct(t.ach)}
          foot={t.target ? <>Target {money(t.target, cur)} <Arrow v={t.ach - 1} /></> : <span className="muted">Target not loaded</span>} />
        <Kpi icon="cons" title="Consumables sales" value={money(t.cons, cur)} foot={`${pct(t.net ? t.cons / t.net : null, 0)} of total sales`} />
        <Kpi icon="equip" title="Equipment sales" value={money(t.equip, cur)} foot={`${pct(t.net ? t.equip / t.net : null, 0)} of total sales`} />
        <Kpi icon="globe" title="Active countries" value={t.activeC} foot={<>vs PY {t.activeCPy} <Arrow v={t.activeC - t.activeCPy} unit="" /></>} />
        <Kpi icon="people" title="Active distributors" value={t.dist} foot={<>vs PY {t.distPy} <Arrow v={t.dist - t.distPy} unit="" /></>} />
      </div>

      <div className="row1">
        <div className="mix-col">
          <Donut title="Product mix – consumables" total={t.cons} share={t.net ? t.cons / t.net : 0} items={s.consMix} colors={MIX_COLORS} cur={cur} />
          <Donut title="Product mix – equipment" total={t.equip} share={t.net ? t.equip / t.net : 0} items={s.equipMix} colors={EQ_COLORS} cur={cur} />
        </div>
        <Card title="Sales performance by country" sub="(YTD)" className="map-card">
          <WorldMap countries={s.mapCountries} cur={cur} selected={f.country !== 'All' ? f.country : null} onPick={pick} />
        </Card>
        <RegionTable rows={s.regions} cur={cur} hasTargets={s.hasTargets} />
      </div>

      <div className="row2">
        <TrendCard trend={s.trend} cur={cur} />
        <TopCountries rows={s.countries} cur={cur} onPick={pick} />
        <Brands title="Top consumables brands" rows={s.consBrands} cur={cur} totalLabel="Total consumables" />
        <Brands title="Top equipment brands" rows={s.equipBrands} cur={cur} totalLabel="Total equipment" />
      </div>

      <footer className="foot">
        <span>Note: sales = invoiced export lines net of credit notes · USD from the invoice currency, other currencies converted at that month's average USD rate · growth and Ach % in the selected currency · click a country to filter</span>
        <span>Source: gold.vw_sales_extract_export_ganit_dashboard (Odoo) · targets: silver_static.export_target</span>
      </footer>
    </>
  )
}
