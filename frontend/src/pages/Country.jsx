import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ReferenceLine } from 'recharts'
import { axisMoney, MONTHS, growthOf, money, pct, prettyCountry, prettyName, signedPct } from '../data.js'
import { AchCell, Card, GrowthCell, Insight, Kpi } from '../ui.jsx'

const COLS = [
  ['name', 'Country'], ['region', 'Region'], ['manager', 'Manager'], ['v', 'Sales'], ['py', 'vs PY'], ['growth', 'Growth %'],
  ['target', 'Target'], ['ach', 'Ach %'], ['dist', 'Distributors'], ['cons', 'Consumables %'],
]

export default function Country({ sc, d, f, setF }) {
  const { ytd, ytdPy, sum, table, cur, cube, tgt, tval, fy, py, asof, val, custs, inYtd } = sc
  const fmt = (v) => money(v, cur)
  const rows = useMemo(() => {
    const dist = new Map()
    custs.filter((r) => inYtd(r, fy) && (r.usd || 0) > 0).forEach((r) => {
      const s = dist.get(r.country) || new Set(); s.add(r.customer_id); dist.set(r.country, s)
    })
    const cons = new Map()
    ytd.filter((r) => r.cls === 'Consumables').forEach((r) => cons.set(r.country, (cons.get(r.country) || 0) + val(r)))
    return table('country', { targets: 'country' }).map((g) => ({
      ...g, region: d.master.get(g.name)?.region || ytd.find((r) => r.country === g.name)?.region || '',
      manager: d.master.get(g.name)?.manager || 'Others', dist: dist.get(g.name)?.size || 0,
      cons: g.v > 0 ? (cons.get(g.name) || 0) / g.v : null,
    }))
  }, [sc])

  const [q, setQ] = useState('')
  const [sort, setSort] = useState(['v', -1])
  const [pickLocal, setPick] = useState(null)
  const shown = rows.filter((r) => !q || prettyCountry(r.name).toLowerCase().includes(q.toLowerCase()) || prettyName(r.region).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const [k, dir] = sort
      const x = a[k] ?? -Infinity, y = b[k] ?? -Infinity
      return typeof x === 'string' ? dir * x.localeCompare(y) : dir * (x - y)
    })
  const pick = f.country !== 'All' ? f.country : pickLocal && rows.some((r) => r.name === pickLocal) ? pickLocal : rows[0]?.name

  const active = rows.filter((r) => r.v > 0)
  const fresh = rows.filter((r) => r.v > 0 && !(r.py > 0))
  const lost = rows.filter((r) => r.py > 0 && !(r.v > 0))
  const total = sum(ytd)
  const top10 = active.slice(0, 10).reduce((a, r) => a + r.v, 0)

  // country detail
  const monthly = MONTHS.map((label, i) => {
    const m = i + 1
    return {
      label,
      actual: m <= asof ? sum(cube.filter((r) => r.country === pick && r.fy === fy && r.m === m)) : null,
      py: sum(cube.filter((r) => r.country === pick && r.fy === py && r.m === m)),
      target: sum(tgt.filter((r) => r.country === pick && r.fy === fy && r.m === m), tval) || null,
    }
  })
  const segs = table('segment', { rows: ytd.filter((r) => r.country === pick), rowsPy: ytdPy.filter((r) => r.country === pick) })
  const brands = table('brand', { rows: ytd.filter((r) => r.country === pick), rowsPy: ytdPy.filter((r) => r.country === pick) }).slice(0, 8)
  const pr = rows.find((r) => r.name === pick)

  const scatter = active.filter((r) => r.growth != null).map((r) => ({ x: r.v, y: Math.max(-1, Math.min(2, r.growth)) * 100, name: prettyCountry(r.name), z: r.v }))

  const head = (k, label) => (
    <th key={k} className="sortable" onClick={() => setSort(([sk, sd]) => [k, sk === k ? -sd : k === 'name' || k === 'region' || k === 'manager' ? 1 : -1])}>
      {label}{sort[0] === k ? (sort[1] > 0 ? ' ▲' : ' ▼') : ''}
    </th>
  )

  return (
    <>
      <div className="kpis k4">
        <Kpi icon="globe" title="Active countries" value={active.length} foot={<>vs PY {rows.filter((r) => r.py > 0).length}</>} />
        <Kpi icon="growth" title="New countries" value={fresh.length} foot="billed this year, not last year" />
        <Kpi icon="pin" title="Countries lost" value={lost.length} tone={lost.length ? 'down' : ''} foot="billed last year, not yet this year" />
        <Kpi icon="target" title="Top 10 concentration" value={pct(total ? top10 / total : null, 0)} foot="share of sales from the 10 largest" />
      </div>

      <div className="grid g-7-5">
        <Card title="All countries" sub="(YTD – click a row for the detail below)">
          <input className="search" placeholder="Search country or region…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="tbl-wrap tall">
            <table className="tbl">
              <thead><tr><th>#</th>{COLS.map(([k, l]) => head(k, l))}</tr></thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={r.name} className={`click ${r.name === pick ? 'sel' : ''}`} onClick={() => setPick(r.name)}>
                    <td className="rank">{i + 1}</td><td>{prettyCountry(r.name)}</td><td className="l muted">{prettyName(r.region)}</td><td className="l muted">{prettyName(r.manager)}</td>
                    <td>{fmt(r.v)}</td><td>{fmt(r.py)}</td><GrowthCell g={r.growth} /><td>{r.target ? fmt(r.target) : '–'}</td><AchCell a={r.ach} />
                    <td>{r.dist || '–'}</td><td>{r.cons == null ? '–' : pct(r.cons, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Size vs growth" sub="(each dot is a country)">
          <div className="chart" style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, bottom: 10 }}>
                <CartesianGrid stroke="#e7ecf3" />
                <XAxis type="number" dataKey="x" name="Sales" scale="log" domain={['auto', 'auto']} tickFormatter={axisMoney(cur)} tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="y" name="Growth" unit="%" tick={{ fontSize: 11 }} width={48} />
                <ZAxis type="number" dataKey="z" range={[30, 260]} />
                <ReferenceLine y={0} stroke="#9aa6b8" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => payload?.[0] ? (
                  <div className="tip"><b>{payload[0].payload.name}</b><br />{fmt(payload[0].payload.x)} · {payload[0].payload.y.toFixed(1)}% vs PY</div>) : null} />
                <Scatter data={scatter} fill="#1f4fc4" fillOpacity={0.6} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <Insight>Top right = large and growing; bottom right = large but shrinking – the first to review. Growth is capped at +200% for the chart.</Insight>
          <div className="twolists">
            <div><h4>New this year</h4>{fresh.slice(0, 8).map((r) => <div key={r.name} className="li">{prettyCountry(r.name)} <span>{fmt(r.v)}</span></div>)}{!fresh.length && <div className="muted">None</div>}</div>
            <div><h4>Lost (billed last year)</h4>{lost.slice(0, 8).map((r) => <div key={r.name} className="li">{prettyCountry(r.name)} <span>{fmt(r.py)} LY</span></div>)}{!lost.length && <div className="muted">None</div>}</div>
          </div>
        </Card>
      </div>

      {pr && (
        <>
          <h3 className="section-h">{prettyCountry(pick)} <small>{prettyName(pr.region)} · {prettyName(pr.manager)} · {fmt(pr.v)} YTD · {pr.growth == null ? 'new' : `${signedPct(pr.growth)} vs PY`}{pr.ach != null ? ` · ${pct(pr.ach, 0)} of target` : ''}</small>
            {f.country === 'All' && <button className="chip" onClick={() => setF((x) => ({ ...x, country: pick }))}>Filter the dashboard to {prettyCountry(pick)}</button>}</h3>
          <div className="grid g-5-4-3">
            <Card title="Month by month" sub={`(${cur})`}>
              <div className="chart" style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthly} margin={{ top: 8, right: 8 }}>
                    <CartesianGrid stroke="#e7ecf3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={axisMoney(cur)} tick={{ fontSize: 11 }} width={56} />
                    <Tooltip formatter={(v) => money(v, cur)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="actual" name="Actual" fill="#1f4fc4" isAnimationActive={false} />
                    <Line dataKey="py" name="PY" stroke="#9aa6b8" strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                    <Line dataKey="target" name="Target" stroke="#f07b21" strokeDasharray="2 3" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Segments">
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Segment</th><th>Sales</th><th>vs PY</th><th>Growth %</th><th>Mix %</th></tr></thead>
                  <tbody>{segs.map((g) => <tr key={g.name}><td>{prettyName(g.name)}</td><td>{fmt(g.v)}</td><td>{fmt(g.py)}</td><GrowthCell g={g.growth} /><td>{pct(g.share)}</td></tr>)}</tbody>
                </table>
              </div>
            </Card>
            <Card title="Top brands">
              <div className="chart" style={{ height: Math.max(200, brands.length * 26 + 30) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brands.map((b) => ({ ...b, label: prettyName(b.name) }))} layout="vertical" margin={{ left: 4, right: 12 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => money(v, cur)} />
                    <Bar dataKey="v" name="This year" fill="#1f4fc4" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
