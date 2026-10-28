import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisMoney, MONTHS, growthOf, money, pct, prettyName, signedPct } from '../data.js'
import { Card, Chips, GrowthCell, HeatTable, Insight, Kpi } from '../ui.jsx'

const CLASSES = ['All', 'Consumables', 'Equipment', 'Service']

export default function Brands({ sc }) {
  const { ytd, ytdPy, sum, table, cur, cube, fy, py, asof, val } = sc
  const [cls, setCls] = useState('All')
  const inCls = (r) => cls === 'All' || r.cls === cls
  const rows = ytd.filter(inCls), rowsPy = ytdPy.filter(inCls)
  const total = sum(rows)
  const fmt = (v) => money(v, cur)

  const brands = useMemo(() => {
    const t = table('brand', { rows, rowsPy, total })
    const seg = new Map(), qty = new Map(), ctry = new Map()
    rows.forEach((r) => {
      seg.set(r.brand, r.segment)
      qty.set(r.brand, (qty.get(r.brand) || 0) + (r.qty || 0))
      if (val(r) > 0) { const s = ctry.get(r.brand) || new Set(); s.add(r.country); ctry.set(r.brand, s) }
    })
    return t.map((g) => ({ ...g, segment: seg.get(g.name) || '', qty: qty.get(g.name) || 0, countries: ctry.get(g.name)?.size || 0 }))
  }, [sc, cls])

  const [pickLocal, setPick] = useState(null)
  const pick = pickLocal && brands.some((b) => b.name === pickLocal) ? pickLocal : brands[0]?.name

  const movers = brands.map((b) => ({ name: prettyName(b.name), d: b.v - b.py }))
  const gainers = [...movers].sort((a, b) => b.d - a.d).filter((m) => m.d > 0).slice(0, 8)
  const decliners = [...movers].sort((a, b) => a.d - b.d).filter((m) => m.d < 0).slice(0, 8)

  const regions = table('region', { rows, rowsPy }).slice(0, 8).map((r) => r.name)
  const top = brands.slice(0, 12).map((b) => b.name)
  const heat = new Map()
  rows.forEach((r) => { const k = `${r.brand}|${r.region}`; heat.set(k, (heat.get(k) || 0) + val(r)) })

  const monthly = MONTHS.map((label, i) => {
    const m = i + 1
    return {
      label,
      actual: m <= asof ? sum(cube.filter((r) => r.brand === pick && r.fy === fy && r.m === m)) : null,
      py: sum(cube.filter((r) => r.brand === pick && r.fy === py && r.m === m)),
    }
  })
  const pb = brands.find((b) => b.name === pick)
  const top5 = brands.slice(0, 5).reduce((a, b) => a + b.v, 0)
  const growing = brands.filter((b) => b.growth != null && b.growth > 0).length

  return (
    <>
      <Chips options={CLASSES} value={cls} onChange={setCls} />
      <div className="kpis k4">
        <Kpi icon="star" title="Brands sold" value={brands.filter((b) => b.v > 0).length} foot={`${cls === 'All' ? 'all classes' : cls}`} />
        <Kpi icon="sales" title="Sales" value={fmt(total)} foot={<>vs PY {fmt(sum(rowsPy))} · {signedPct(growthOf(total, sum(rowsPy)))}</>} />
        <Kpi icon="growth" title="Brands growing" value={`${growing} of ${brands.filter((b) => b.py > 0).length}`} foot="brands sold in both years" />
        <Kpi icon="target" title="Top 5 brands share" value={pct(total ? top5 / total : null, 0)} foot="of sales in this class" />
      </div>

      <div className="grid g-7-5">
        <Card title="Brand performance" sub="(YTD – click a row for its trend)">
          <div className="tbl-wrap tall">
            <table className="tbl">
              <thead><tr><th>#</th><th>Brand</th><th>Segment</th><th>Sales</th><th>vs PY</th><th>Growth %</th><th>Mix %</th><th>Units</th><th>Countries</th></tr></thead>
              <tbody>
                {brands.map((b, i) => (
                  <tr key={b.name} className={`click ${b.name === pick ? 'sel' : ''}`} onClick={() => setPick(b.name)}>
                    <td className="rank">{i + 1}</td><td>{prettyName(b.name)}</td><td className="l muted">{prettyName(b.segment)}</td>
                    <td>{fmt(b.v)}</td><td>{fmt(b.py)}</td><GrowthCell g={b.growth} /><td>{pct(b.share)}</td>
                    <td>{Math.round(b.qty).toLocaleString('en-IN')}</td><td>{b.countries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="stack">
          <Card title={`${prettyName(pick || '')} – month by month`} sub={`(${cur})`}>
            <div className="chart" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly} margin={{ top: 8, right: 8 }}>
                  <CartesianGrid stroke="#e7ecf3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={axisMoney(cur)} tick={{ fontSize: 11 }} width={56} />
                  <Tooltip formatter={(v) => money(v, cur)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="actual" name="This year" fill="#1f4fc4" isAnimationActive={false} />
                  <Line dataKey="py" name="Last year" stroke="#9aa6b8" strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <Insight>{pb && <>{prettyName(pb.name)}: {fmt(pb.v)} YTD, {pb.growth == null ? 'new this year' : `${signedPct(pb.growth)} vs last year`}, sold in {pb.countries} countries.</>}</Insight>
          </Card>
          <Card title="Biggest gainers and decliners" sub={`(change vs PY, ${cur})`}>
            <div className="chart" style={{ height: Math.max(180, (gainers.length + decliners.length) * 22 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...gainers, ...decliners.reverse()]} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke="#e7ecf3" horizontal={false} />
                  <XAxis type="number" tickFormatter={axisMoney(cur)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => money(v, cur)} />
                  <Bar dataKey="d" name="Change vs PY" isAnimationActive={false}>
                    {[...gainers, ...decliners].map((m) => <Cell key={m.name} fill={m.d >= 0 ? '#11924a' : '#d1342f'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <Card title="Top brands by region" sub="(YTD sales)">
        <HeatTable rows={top} cols={regions} get={(r, c) => heat.get(`${r}|${c}`)} fmt={(v) => money(v, cur, 1)} rowLabel={prettyName} colLabel={prettyName} corner="Brand" />
      </Card>
    </>
  )
}
