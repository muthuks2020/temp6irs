import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisMoney, MONTHS, growthOf, money, pct, prettyCountry, prettyName, signedPct } from '../data.js'
import { AchCell, Card, Chips, GrowthCell, Insight, achClass } from '../ui.jsx'

const QUARTERS = [[1, 3], [4, 6], [7, 9], [10, 12]]

export default function Regional({ sc, d, f, setF }) {
  const { ytd, ytdPy, sum, table, cur, cube, tgt, tval, fy, py, asof, val, inYtd } = sc
  const regions = table('region', { targets: 'region' })
  const [focus, setFocus] = useState(null)
  const sel = f.region !== 'All' ? f.region : focus && regions.some((r) => r.name === focus) ? focus : regions[0]?.name
  const fmt = (v) => money(v, cur)

  const spark = (name) => MONTHS.slice(0, asof).map((_, i) => ({ v: sum(cube.filter((r) => r.region === name && r.fy === fy && r.m === i + 1)) }))

  // focus region month by month
  const monthly = MONTHS.map((label, i) => {
    const m = i + 1
    return {
      label,
      actual: m <= asof ? sum(cube.filter((r) => r.region === sel && r.fy === fy && r.m === m)) : null,
      py: sum(cube.filter((r) => r.region === sel && r.fy === py && r.m === m)),
      target: sum(tgt.filter((r) => r.region === sel && r.fy === fy && r.m === m), tval) || null,
    }
  })

  // product class mix by region (share of each region's sales)
  const mix = regions.map((g) => {
    const rows = ytd.filter((r) => r.region === g.name)
    const t = sum(rows) || 1
    return {
      name: prettyName(g.name),
      Consumables: sum(rows.filter((r) => r.cls === 'Consumables')) / t,
      Equipment: sum(rows.filter((r) => r.cls === 'Equipment')) / t,
      Service: sum(rows.filter((r) => r.cls === 'Service')) / t,
    }
  })

  // export managers (from the export target master)
  const mgrOf = (c) => d.master.get(c)?.manager || 'Others'
  const mgrs = table((r) => mgrOf(r.country), { targets: (r) => mgrOf(r.country) }).map((g) => ({
    ...g,
    countries: new Set(ytd.filter((r) => mgrOf(r.country) === g.name && val(r) > 0).map((r) => r.country)).size,
    regions: [...new Set(ytd.filter((r) => mgrOf(r.country) === g.name).map((r) => r.region))].map(prettyName).join(', '),
  }))

  // quarters: this year vs last year, same days for the open quarter
  const qRows = regions.map((g) => ({
    name: g.name,
    q: QUARTERS.map(([a, b]) => {
      const v = sum(cube.filter((r) => r.region === g.name && r.fy === fy && r.m >= a && r.m <= b && r.m <= asof))
      const p = sum(cube.filter((r) => r.region === g.name && r.fy === py && r.m >= a && r.m <= b && r.m <= asof && inYtd(r, py)))
      return { v, p, g: a <= asof ? growthOf(v, p) : null, future: a > asof }
    }),
  }))

  const lead = regions[0], fastest = [...regions].filter((r) => r.py > 0).sort((a, b) => b.growth - a.growth)[0]
  const behind = regions.filter((r) => r.ach != null && r.ach < 0.9)

  return (
    <>
      <div className="region-tiles">
        {regions.map((g) => (
          <button key={g.name} className={`rtile ${g.name === sel ? 'on' : ''}`} onClick={() => setFocus(g.name)}>
            <span className="rt-name">{prettyName(g.name)}</span>
            <span className="rt-value">{fmt(g.v)}</span>
            <span className="rt-line"><span className={g.growth == null ? '' : g.growth >= 0 ? 'up' : 'down'}>{g.growth == null ? 'new' : signedPct(g.growth)}</span> vs PY</span>
            <span className="rt-ach"><span>{g.ach == null ? 'No target' : <>Ach <b className={`ach ${achClass(g.ach)}`}>{pct(g.ach, 0)}</b> of target</>}</span>
              <i className="achbar"><i style={{ width: `${Math.min(100, (g.ach || 0) * 100)}%` }} className={achClass(g.ach)} /></i></span>
            <span className="rt-spark">
              <ResponsiveContainer width="100%" height={34}>
                <LineChart data={spark(g.name)}><Line dataKey="v" stroke="#1f4fc4" strokeWidth={1.6} dot={false} isAnimationActive={false} /></LineChart>
              </ResponsiveContainer>
            </span>
          </button>
        ))}
      </div>
      <Insight>{lead && <>{prettyName(lead.name)} is the largest region at {pct(lead.share, 0)} of export sales{fastest && fastest !== lead ? <>; {prettyName(fastest.name)} is growing fastest ({signedPct(fastest.growth)})</> : ''}.
        {behind.length ? <> Below 90% of target: {behind.map((b) => prettyName(b.name)).join(', ')}.</> : ''}</>}</Insight>

      <div className="grid g-7-5">
        <Card title={`${prettyName(sel || '')} – month by month`} sub={`(${cur})`}>
          {f.region === 'All' && <Chips options={regions.map((r) => r.name)} value={sel} onChange={setFocus} label={prettyName} />}
          <div className="chart" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={{ top: 8, right: 8 }}>
                <CartesianGrid stroke="#e7ecf3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={axisMoney(cur)} tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => money(v, cur)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="actual" name="Actual" fill="#1f4fc4" isAnimationActive={false} />
                <Line dataKey="py" name="PY" stroke="#9aa6b8" strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                <Line dataKey="target" name="Target" stroke="#f07b21" strokeDasharray="2 3" strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {f.region === 'All' && <p className="note"><button className="chip" onClick={() => setF((x) => ({ ...x, region: sel, country: 'All' }))}>Filter the whole dashboard to {prettyName(sel || '')}</button></p>}
        </Card>
        <Card title="Product mix by region" sub="(share of each region's sales)">
          <div className="chart" style={{ height: Math.max(220, mix.length * 34 + 50) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mix} layout="vertical" stackOffset="expand" margin={{ left: 8, right: 12 }}>
                <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11.5 }} />
                <Tooltip formatter={(v) => pct(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Consumables" stackId="a" fill="#1f4fc4" isAnimationActive={false} />
                <Bar dataKey="Equipment" stackId="a" fill="#12a39a" isAnimationActive={false} />
                <Bar dataKey="Service" stackId="a" fill="#f4b942" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid g-6-6">
        <Card title="Export managers">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Manager</th><th>Regions</th><th>Countries</th><th>Sales</th><th>vs PY</th><th>Growth %</th><th>Target</th><th>Ach %</th></tr></thead>
              <tbody>
                {mgrs.map((g) => (
                  <tr key={g.name}><td>{prettyName(g.name)}</td><td className="l muted wrap">{g.regions}</td><td>{g.countries}</td><td>{fmt(g.v)}</td><td>{fmt(g.py)}</td>
                    <GrowthCell g={g.growth} /><td>{g.target ? fmt(g.target) : '–'}</td><AchCell a={g.ach} /></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Quarterly growth by region" sub="(vs same period last year)">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Region</th>{['Q1', 'Q2', 'Q3', 'Q4'].map((q) => <th key={q}>{q}</th>)}<th>YTD</th></tr></thead>
              <tbody>
                {qRows.map((r) => (
                  <tr key={r.name}><td>{prettyName(r.name)}</td>
                    {r.q.map((q, i) => <td key={i} className={q.future || q.g == null ? 'muted' : q.g >= 0 ? 'up' : 'down'} title={`${fmt(q.v)} vs ${fmt(q.p)}`}>
                      {q.future ? '–' : <>{fmt(q.v)}<small className="sub">{q.g == null ? 'new' : signedPct(q.g)}</small></>}</td>)}
                    <GrowthCell g={regions.find((g) => g.name === r.name)?.growth} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title={`Countries in ${prettyName(sel || '')}`}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Country</th><th>Manager</th><th>Sales</th><th>vs PY</th><th>Growth %</th><th>Target</th><th>Ach %</th><th>Share of region</th></tr></thead>
            <tbody>
              {table('country', { rows: ytd.filter((r) => r.region === sel), rowsPy: ytdPy.filter((r) => r.region === sel), targets: 'country' }).map((g) => (
                <tr key={g.name}><td>{prettyCountry(g.name)}</td><td className="l muted">{prettyName(mgrOf(g.name))}</td><td>{fmt(g.v)}</td><td>{fmt(g.py)}</td>
                  <GrowthCell g={g.growth} /><td>{g.target ? fmt(g.target) : '–'}</td><AchCell a={g.ach} /><td>{pct(g.share)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
