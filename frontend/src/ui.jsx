import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { money, pct, prettyName } from './data.js'

export const MIX_COLORS = ['#1f6fe0', '#0b2a6b', '#12a39a', '#f4b942']
export const EQ_COLORS = ['#1f4fc4', '#12a39a', '#f07b21', '#f4b942']
export const SERIES = ['#1f4fc4', '#12a39a', '#f07b21', '#f4b942', '#7a5af8', '#0b2a6b', '#d1342f', '#5f97df']

// ---------------------------------------------------------------- icons (inline, no library)
export const I = {
  sales: <path d="M4 18V9m5 9V5m5 13v-6m5 6V8" />,
  growth: <path d="M4 18l6-6 4 4 6-8M14 8h6v6" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
  cons: <path d="M9 3h6v3l2 3v11H7V9l2-3z M7 13h10" />,
  equip: <path d="M5 20h14M8 20v-4h8v4M10 16V8h4v8M9 4h6v4H9z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>,
  people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.5 3-5.5 6-5.5s6 2 6 5.5M15 15c3 0 6 1.5 6 4.5" /></>,
  home: <path d="M3 11l9-7 9 7v9H3zM9 20v-6h6v6" />,
  box: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />,
  pin: <><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  star: <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" />,
  chart: <path d="M4 20V10m5 10V6m5 14v-8m5 8V4M3 20h18" />,
  refresh: <path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />,
}
export const Icon = ({ n, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>
)

// ---------------------------------------------------------------- small pieces
export const Arrow = ({ v, unit = '%', pp, invert }) => {
  if (v == null || !isFinite(v)) return <span className="muted">–</span>
  const up = v >= 0
  const good = invert ? !up : up
  const txt = pp ? `${Math.abs(v * 100).toFixed(1)} pp` : unit === '' ? `${Math.abs(v)}` : `${Math.abs(v * 100).toFixed(1)}%`
  return <span className={good ? 'up' : 'down'}>{up ? '▲' : '▼'} {up ? '' : '-'}{txt}</span>
}
export const achClass = (a) => (a == null ? '' : a >= 0.97 ? 'ok' : a >= 0.9 ? 'warn' : 'bad')

export function Kpi({ icon, title, value, foot, tone }) {
  return (
    <div className="kpi">
      <div className="kpi-ico"><Icon n={icon} size={30} /></div>
      <div className="kpi-body">
        <div className="kpi-title">{title}</div>
        <div className={`kpi-value ${tone || ''}`}>{value}</div>
        <div className="kpi-foot">{foot}</div>
      </div>
    </div>
  )
}

export function Card({ title, sub, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <h2>{title}{sub && <small> {sub}</small>}</h2>
      {children}
    </section>
  )
}

export function Donut({ title, total, share, items, colors, cur }) {
  return (
    <Card title={title} className="donut-card">
      <div className="donut">
        <div className="donut-chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="v" nameKey="name" innerRadius="58%" outerRadius="96%" startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                {items.map((it, i) => <Cell key={it.name} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => money(v, cur)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center"><b>{money(total, cur)}</b><span>{pct(share, 0)}</span></div>
        </div>
        <ul className="donut-legend">
          {items.map((it, i) => (
            <li key={it.name}><i style={{ background: colors[i % colors.length] }} /><div><b>{prettyName(it.name)}</b><span>{money(it.v, cur)} ({pct(it.share)})</span></div></li>
          ))}
          {!items.length && <li className="muted">No sales in this selection</li>}
        </ul>
      </div>
    </Card>
  )
}

export const GrowthCell = ({ g }) => <td className={g == null ? '' : g >= 0 ? 'up' : 'down'}>{g == null ? 'new' : `${g >= 0 ? '' : '-'}${Math.abs(g * 100).toFixed(1)}%`}</td>
export const AchCell = ({ a, d = 0 }) => <td className={`ach ${achClass(a)}`}>{a == null ? '–' : `${(a * 100).toFixed(d)}%`}</td>

// heat table: rows x columns of values, shaded by size within the table
export function HeatTable({ rows, cols, get, fmt, rowLabel = (r) => r, colLabel = (c) => c, corner = '' }) {
  const vals = rows.flatMap((r) => cols.map((c) => get(r, c) || 0))
  const max = Math.max(1, ...vals)
  return (
    <div className="tbl-wrap">
      <table className="tbl heat">
        <thead><tr><th>{corner}</th>{cols.map((c) => <th key={c}>{colLabel(c)}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}><td>{rowLabel(r)}</td>
              {cols.map((c) => {
                const v = get(r, c) || 0
                const a = v > 0 ? 0.08 + 0.72 * (v / max) : 0
                return <td key={c} style={{ background: v > 0 ? `rgba(31,79,196,${a.toFixed(3)})` : undefined, color: a > 0.45 ? '#fff' : undefined }}>{v > 0 ? fmt(v) : '–'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// clickable chips to pick one option
export function Chips({ options, value, onChange, label = (o) => o }) {
  return (
    <div className="chips">
      {options.map((o) => <button key={o} className={o === value ? 'on' : ''} onClick={() => onChange(o)}>{label(o)}</button>)}
    </div>
  )
}

export function Insight({ children }) {
  return children ? <p className="insight">{children}</p> : null
}
