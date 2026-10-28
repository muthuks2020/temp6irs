import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisMoney, MONTHS, growthOf, money, pct, prettyName, signedPct } from '../data.js'
import { Arrow, Card, Chips, GrowthCell, HeatTable, Insight, Kpi, SERIES } from '../ui.jsx'

const CLASSES = ['Consumables', 'Equipment', 'Service']
const CLS_COLOR = { Consumables: '#1f4fc4', Equipment: '#12a39a', Service: '#f4b942' }

export default function Product({ sc }) {
  const { ytd, ytdPy, sum, table, cur, cube, fy, py, asof, val } = sc
  const total = sum(ytd)
  const cls = CLASSES.map((c) => {
    const v = sum(ytd.filter((r) => r.cls === c)), p = sum(ytdPy.filter((r) => r.cls === c))
    return { c, v, p, g: growthOf(v, p), share: total ? v / total : 0 }
  })
  const units = sum(ytd, (r) => r.qty || 0), unitsPy = sum(ytdPy, (r) => r.qty || 0)

  // segment table with units and average price
  const segs = useMemo(() => {
    const t = table('segment', { total })
    const q = new Map(), qp = new Map(), cl = new Map()
    ytd.forEach((r) => { q.set(r.segment, (q.get(r.segment) || 0) + (r.qty || 0)); cl.set(r.segment, r.cls) })
    ytdPy.forEach((r) => qp.set(r.segment, (qp.get(r.segment) || 0) + (r.qty || 0)))
    return t.map((g) => ({ ...g, cls: cl.get(g.name) || '', qty: q.get(g.name) || 0, qtyPy: qp.get(g.name) || 0, asp: q.get(g.name) ? g.v / q.get(g.name) : null }))
  }, [sc])

  // change vs last year by segment (diverging)
  const change = segs.map((g) => ({ name: prettyName(g.name), d: g.v - g.py })).sort((a, b) => b.d - a.d)

  // monthly by class, stacked, with last year's total
  const monthly = MONTHS.map((label, i) => {
    const m = i + 1
    const row = { label }
    CLASSES.forEach((c) => { row[c] = m <= asof ? sum(cube.filter((r) => r.fy === fy && r.m === m && r.cls === c)) : null })
    row.PY = sum(cube.filter((r) => r.fy === py && r.m === m))
    return row
  })

  // segment x region
  const regions = table('region').slice(0, 8).map((r) => r.name)
  const topSegs = segs.slice(0, 8).map((s) => s.name)
  const heat = new Map()
  ytd.forEach((r) => { const k = `${r.segment}|${r.region}`; heat.set(k, (heat.get(k) || 0) + val(r)) })

  // drill: segment -> family -> brand
  const [seg, setSeg] = useState(null)
  const pick = seg && segs.some((s) => s.name === seg) ? seg : segs[0]?.name
  const fam = pick ? table('family', { rows: ytd.filter((r) => r.segment === pick), rowsPy: ytdPy.filter((r) => r.segment === pick) }) : []
  const brands = pick ? table('brand', { rows: ytd.filter((r) => r.segment === pick), rowsPy: ytdPy.filter((r) => r.segment === pick) }).slice(0, 10) : []

  const best = [...segs].filter((s) => s.py > 0).sort((a, b) => b.growth - a.growth)[0]
  const worst = [...segs].filter((s) => s.py > 0).sort((a, b) => a.growth - b.growth)[0]
  const fmt = (v) => money(v, cur)

  return (
    <>
      <div className="kpis k4">
        {cls.map((x) => (
          <Kpi key={x.c} icon={x.c === 'Equipment' ? 'equip' : x.c === 'Service' ? 'refresh' : 'cons'} title={`${x.c === 'Service' ? 'Service & spares' : x.c} sales`}
            value={money(x.v, cur)} foot={<>{pct(x.share, 0)} of sales · vs PY {money(x.p, cur)} <Arrow v={x.g} /></>} />
        ))}
        <Kpi icon="box" title="Units sold" value={Math.round(units).toLocaleString('en-IN')} foot={<>vs PY {Math.round(unitsPy).toLocaleString('en-IN')} <Arrow v={growthOf(units, unitsPy)} /></>} />
      </div>

      <div className="grid g-7-5">
        <Card title="Segment performance" sub="(YTD)">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Segment</th><th>Class</th><th>Sales</th><th>vs PY</th><th>Growth %</th><th>Mix %</th><th>Units</th><th>Avg price</th></tr></thead>
              <tbody>
                {segs.map((g) => (
                  <tr key={g.name} className={`click ${g.name === pick ? 'sel' : ''}`} onClick={() => setSeg(g.name)}>
                    <td>{prettyName(g.name)}</td><td className="muted l">{g.cls}</td><td>{fmt(g.v)}</td><td>{fmt(g.py)}</td>
                    <GrowthCell g={g.growth} /><td>{pct(g.share)}</td><td>{Math.round(g.qty).toLocaleString('en-IN')}</td><td>{g.asp ? money(g.asp, cur, 1) : '–'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>Total</td><td /><td>{fmt(total)}</td><td>{fmt(sum(ytdPy))}</td><td>{signedPct(growthOf(total, sum(ytdPy)))}</td><td>100%</td>
                <td>{Math.round(units).toLocaleString('en-IN')}</td><td /></tr></tfoot>
            </table>
          </div>
          <Insight>{best && worst && best !== worst && <>Fastest growing: <b>{prettyName(best.name)}</b> ({signedPct(best.growth)}); slowest: <b>{prettyName(worst.name)}</b> ({signedPct(worst.growth)}). Click a segment to see its families and brands.</>}</Insight>
        </Card>
        <Card title="Change vs last year by segment" sub={`(${cur})`}>
          <div className="chart" style={{ height: Math.max(200, change.length * 30 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={change} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="#e7ecf3" horizontal={false} />
                <XAxis type="number" tickFormatter={axisMoney(cur)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11.5 }} />
                <Tooltip formatter={(v) => money(v, cur)} />
                <Bar dataKey="d" name="Change vs PY" isAnimationActive={false}>
                  {change.map((c) => <Cell key={c.name} fill={c.d >= 0 ? '#11924a' : '#d1342f'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid g-7-5">
        <Card title="Monthly sales by product class" sub={`(${cur})`}>
          <div className="chart" style={{ height: 290 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={{ top: 8, right: 8 }}>
                <CartesianGrid stroke="#e7ecf3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={axisMoney(cur)} tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => money(v, cur)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {CLASSES.map((c) => <Bar key={c} dataKey={c} stackId="a" fill={CLS_COLOR[c]} isAnimationActive={false} />)}
                <Line dataKey="PY" name="Last year (total)" stroke="#9aa6b8" strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Segments by region" sub="(YTD sales)">
          <HeatTable rows={topSegs} cols={regions} get={(r, c) => heat.get(`${r}|${c}`)} fmt={(v) => money(v, cur, 1)}
            rowLabel={prettyName} colLabel={prettyName} corner="Segment" />
        </Card>
      </div>

      <div className="grid g-6-6">
        <Card title={`Product families – ${prettyName(pick || '')}`}>
          <Chips options={segs.map((s) => s.name)} value={pick} onChange={setSeg} label={prettyName} />
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Family</th><th>Sales</th><th>vs PY</th><th>Growth %</th><th>Share of segment</th></tr></thead>
              <tbody>
                {fam.map((g) => <tr key={g.name}><td>{prettyName(g.name)}</td><td>{fmt(g.v)}</td><td>{fmt(g.py)}</td><GrowthCell g={g.growth} /><td>{pct(g.share)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={`Top brands – ${prettyName(pick || '')}`}>
          <div className="chart" style={{ height: Math.max(220, brands.length * 28 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brands.map((b) => ({ ...b, label: prettyName(b.name) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="#e7ecf3" horizontal={false} />
                <XAxis type="number" tickFormatter={axisMoney(cur)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11.5 }} />
                <Tooltip formatter={(v) => money(v, cur)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="v" name="This year" fill={SERIES[0]} isAnimationActive={false} />
                <Bar dataKey="py" name="Last year" fill="#c3cfe2" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  )
}
