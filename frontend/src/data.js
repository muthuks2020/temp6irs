// All calculations for the Executive Summary, done in the browser from one bundle per fiscal year.
// Filters (as-of month, region, country, currency) never go back to the database.

export const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

export const fyLabel = (fy) => (fy ? `FY${fy.slice(2, 4)}-${fy.slice(5, 7)}` : '')

// ---------------------------------------------------------------- formatting
export function money(v, cur, digits = 1) {
  if (v == null || !isFinite(v)) return '–'
  const s = v < 0 ? '-' : ''
  const a = Math.abs(v)
  if (cur === 'INR') {
    if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(digits)} Cr`
    if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(digits)} L`
    return `${s}₹${Math.round(a).toLocaleString('en-IN')}`
  }
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(digits)}M`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(digits)}K`
  return `${s}$${Math.round(a)}`
}
// axis labels: one decimal, without a trailing .0
export const axisMoney = (cur) => (v) => money(v, cur, 1).replace('.0', '')
export const pct = (v, d = 1) => (v == null || !isFinite(v) ? '–' : `${(v * 100).toFixed(d)}%`)
export const signedPct = (v, d = 1) => (v == null || !isFinite(v) ? '–' : `${v >= 0 ? '' : '-'}${Math.abs(v * 100).toFixed(d)}%`)

const SPECIAL = { 'U.A.E.': 'UAE', 'U.S.A.': 'USA', 'U.K.': 'UK', NETHARLANDS: 'Netherlands', 'D.R.CONGO': 'DR Congo' }
export function prettyCountry(c) {
  if (!c) return ''
  if (SPECIAL[c]) return SPECIAL[c]
  return c.toLowerCase().replace(/(^|[\s(-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bAnd\b/g, 'and').replace(/\bOf\b/g, 'of')
}
// upper-case names from Odoo -> Title Case, keeping short codes (IOL, OVD, MSI, HPMC, CIS, SAARC, YAG) as they are
const KEEP = new Set(['SAARC', 'APAC', 'LATAM', 'EMEA', 'GCC', 'CIS', 'MEA', 'USA', 'UAE', 'UK'])
export const prettyName = (s) => {
  if (!s) return ''
  if (s !== s.toUpperCase()) return s
  return s.split(/(\s+|[-/&()])/).map((w) => (KEEP.has(w) || w.length <= 4 || !/^[A-Z]/.test(w) ? w : w[0] + w.slice(1).toLowerCase())).join('')
}

// ---------------------------------------------------------------- bundle -> objects
const objs = (t) => {
  if (!t) return []
  const c = t.cols
  return t.rows.map((r) => Object.fromEntries(c.map((k, i) => [k, r[i]])))
}
export function prepare(b) {
  const countries = objs(b.countries)
  const master = new Map(countries.map((c) => [c.country, c]))
  return {
    meta: b.meta, cube: objs(b.cube), targets: objs(b.targets), customers: objs(b.customers), rates: objs(b.rates),
    countries, master, orders: objs(b.orders).map((o) => ({ ...o, region: master.get(o.country)?.region || 'Unassigned' })),
    ordersError: b.orders?.error || null,
  }
}

export function regionsOf(d) {
  const s = new Set()
  d.cube.forEach((r) => s.add(r.region))
  d.targets.forEach((r) => s.add(r.region))
  return [...s].filter(Boolean).sort()
}
// export manager of a country (from the export target master) and the manager filter
export const managerOf = (d, c) => d.master.get(c)?.manager || 'Others'
export const mgrOk = (d, f, c) => !f.manager || f.manager === 'All' || managerOf(d, c) === f.manager
export function managersOf(d, region) {
  const s = new Set()
  d.cube.forEach((r) => (region === 'All' || r.region === region) && s.add(managerOf(d, r.country)))
  return [...s].filter(Boolean).sort()
}
export function countriesOf(d, region, manager = 'All') {
  const s = new Set()
  d.cube.forEach((r) => (region === 'All' || r.region === region) && (manager === 'All' || managerOf(d, r.country) === manager) && s.add(r.country))
  return [...s].filter(Boolean).sort()
}
export function defaultAsOf(d) {
  if (d.meta.cut_m) return d.meta.cut_m
  const ms = d.cube.filter((r) => r.fy === d.meta.fy).map((r) => r.m)
  return ms.length ? Math.max(...ms) : 12
}

// ---------------------------------------------------------------- the summary
export function summarise(d, f) {
  const { fy, prev_fy: py, prev2_fy: py2, cut_m: cutM } = d.meta
  const cur = f.currency
  const asof = f.asof
  const open = cutM && asof === cutM // the as-of month is still open -> compare same days last year
  const keep = (r) => (f.region === 'All' || r.region === f.region) && (f.country === 'All' || r.country === f.country) && mgrOk(d, f, r.country)
  const val = (r) => (cur === 'INR' ? r.inr : r.usd) || 0
  const lastRate = d.rates.filter((r) => r.fy === fy).sort((a, b) => b.m - a.m)[0]?.usd_inr || 83
  const rate = (y, m) => d.rates.find((r) => r.fy === y && r.m === m)?.usd_inr || lastRate
  const tval = (r) => (cur === 'INR' ? r.target_usd * rate(r.fy, r.m) : r.target_usd) || 0

  // rows inside the YTD window, like for like
  const inYtd = (r, year) => {
    if (r.fy !== year || r.m > asof || !keep(r)) return false
    if (year !== fy && open && r.m === asof && r.early === false) return false
    return true
  }
  const cube = d.cube.filter(keep)
  const ytd = cube.filter((r) => inYtd(r, fy))
  const ytdPy = cube.filter((r) => inYtd(r, py))
  const ytdPy2 = cube.filter((r) => inYtd(r, py2))
  const sum = (rows, fn = val) => rows.reduce((a, r) => a + fn(r), 0)
  const tgt = d.targets.filter((r) => keep(r))
  const tgtYtd = tgt.filter((r) => r.fy === fy && r.m <= asof)
  const tgtFull = tgt.filter((r) => r.fy === fy)

  const net = sum(ytd), netPy = sum(ytdPy), netPy2 = sum(ytdPy2)
  const target = sum(tgtYtd, tval), targetFull = sum(tgtFull, tval)
  const growth = netPy ? net / netPy - 1 : null
  const growthPy = netPy2 ? netPy / netPy2 - 1 : null
  const ach = target ? net / target : null
  const cons = sum(ytd.filter((r) => r.cls === 'Consumables'))
  const equip = sum(ytd.filter((r) => r.cls === 'Equipment'))

  const distinct = (rows, key) => new Set(rows.filter((r) => val(r) > 0 || (r.usd || 0) > 0).map((r) => r[key])).size
  const countryNet = (rows) => {
    const m = new Map()
    rows.forEach((r) => m.set(r.country, (m.get(r.country) || 0) + val(r)))
    return m
  }
  const activeC = [...countryNet(ytd).values()].filter((v) => v > 0).length
  const activeCPy = [...countryNet(ytdPy).values()].filter((v) => v > 0).length
  const custs = d.customers.filter(keep)
  const dist = distinct(custs.filter((r) => inYtd(r, fy)), 'customer_id')
  const distPy = distinct(custs.filter((r) => inYtd(r, py)), 'customer_id')

  // group helper
  const group = (rows, key, rowsPy) => {
    const m = new Map()
    rows.forEach((r) => { const g = m.get(r[key]) || { name: r[key], v: 0, py: 0 }; g.v += val(r); m.set(r[key], g) })
    ;(rowsPy || []).forEach((r) => { const g = m.get(r[key]) || { name: r[key], v: 0, py: 0 }; g.py += val(r); m.set(r[key], g) })
    return [...m.values()].sort((a, b) => b.v - a.v)
  }
  const topN = (list, n, total) => {
    const head = list.filter((g) => g.v > 0).slice(0, n)
    const rest = list.slice(n)
    const others = rest.reduce((a, g) => ({ name: 'Others', v: a.v + g.v, py: a.py + g.py, others: true }), { name: 'Others', v: 0, py: 0, others: true })
    const out = others.v > 0 || others.py > 0 ? [...head, others] : head
    return out.map((g) => ({ ...g, share: total ? g.v / total : 0, growth: g.py ? g.v / g.py - 1 : null }))
  }

  const consMix = topN(group(ytd.filter((r) => r.cls === 'Consumables'), 'segment'), 3, cons)
  const equipMix = topN(group(ytd.filter((r) => r.cls === 'Equipment'), 'family'), 3, equip)

  // targets by region / country
  const tBy = (key) => {
    const m = new Map()
    tgtYtd.forEach((r) => m.set(r[key], (m.get(r[key]) || 0) + tval(r)))
    return m
  }
  const tReg = tBy('region'), tCty = tBy('country')
  const regions = group(ytd, 'region', ytdPy).map((g) => ({
    ...g, growth: g.py ? g.v / g.py - 1 : null, target: tReg.get(g.name) || 0,
    ach: tReg.get(g.name) ? g.v / tReg.get(g.name) : null,
  })).filter((g) => Math.abs(g.v) + Math.abs(g.py) > 0.5)
  const countries = group(ytd, 'country', ytdPy).map((g) => ({
    ...g, growth: g.py ? g.v / g.py - 1 : null, target: tCty.get(g.name) || 0,
    ach: tCty.get(g.name) ? g.v / tCty.get(g.name) : null,
  }))

  // the map always shows every country of the region, with the picked country outlined
  const regionOnly = (r) => (f.region === 'All' || r.region === f.region) && mgrOk(d, f, r.country)
  const mapCountries = group(d.cube.filter((r) => regionOnly(r) && r.fy === fy && r.m <= asof), 'country',
    d.cube.filter((r) => regionOnly(r) && r.fy === py && r.m <= asof && !(open && r.m === asof && r.early === false)))
    .map((g) => ({ ...g, growth: g.py ? g.v / g.py - 1 : null }))

  const brands = (cls, n) => {
    const total = cls === 'Consumables' ? cons : equip
    const list = group(ytd.filter((r) => r.cls === cls), 'brand', ytdPy.filter((r) => r.cls === cls))
    return topN(list, n, total)
  }

  // monthly trend: actual (to as-of), last year, target
  const trend = MONTHS.map((label, i) => {
    const m = i + 1
    const a = cube.filter((r) => r.fy === fy && r.m === m)
    const p = cube.filter((r) => r.fy === py && r.m === m)
    const t = tgt.filter((r) => r.fy === fy && r.m === m)
    return { label, m, actual: m <= asof && a.length ? sum(a) : null, py: p.length ? sum(p) : null, target: t.length ? sum(t, tval) : null }
  })

  return {
    fy, py, asof, open, cur,
    tiles: { net, netPy, growth, growthPy, ach, target, targetFull, cons, equip, activeC, activeCPy, dist, distPy },
    consMix, equipMix, regions, countries, mapCountries,
    consBrands: brands('Consumables', 6), equipBrands: brands('Equipment', 5),
    trend, hasTargets: target > 0,
  }
}

// ================================================================ shared scope for the detail pages
// Everything a page needs for the current filters: like-for-like YTD rows, targets, helpers.
export function scope(d, f) {
  const { fy, prev_fy: py, prev2_fy: py2, cut_m: cutM } = d.meta
  const cur = f.currency
  const asof = f.asof
  const open = !!cutM && asof === cutM
  const keep = (r) => (f.region === 'All' || r.region === f.region) && (f.country === 'All' || r.country === f.country) && mgrOk(d, f, r.country)
  const val = (r) => (cur === 'INR' ? r.inr : r.usd) || 0
  const lastRate = d.rates.filter((r) => r.fy === fy).sort((a, b) => b.m - a.m)[0]?.usd_inr || 83
  const rate = (y, m) => d.rates.find((r) => r.fy === y && r.m === m)?.usd_inr || lastRate
  const tval = (r) => (cur === 'INR' ? r.target_usd * rate(r.fy, r.m) : r.target_usd) || 0
  const inYtd = (r, year) => {
    if (r.fy !== year || r.m > asof) return false
    if (year !== fy && open && r.m === asof && r.early === false) return false
    return true
  }
  const cube = d.cube.filter(keep)
  const ytd = cube.filter((r) => inYtd(r, fy))
  const ytdPy = cube.filter((r) => inYtd(r, py))
  const ytdPy2 = cube.filter((r) => inYtd(r, py2))
  const tgt = d.targets.filter(keep)
  const tgtYtd = tgt.filter((r) => r.fy === fy && r.m <= asof)
  const tgtFull = tgt.filter((r) => r.fy === fy)
  const custs = d.customers.filter(keep)
  const sum = (rows, fn = val) => rows.reduce((a, r) => a + fn(r), 0)
  const by = (rows, key, fn = val) => {
    const m = new Map()
    rows.forEach((r) => { const k = typeof key === 'function' ? key(r) : r[key]; m.set(k, (m.get(k) || 0) + fn(r)) })
    return m
  }
  // name, v (YTD), py (PY YTD), growth, share, target, ach
  const table = (key, { rows = ytd, rowsPy = ytdPy, targets = null, total = null } = {}) => {
    const a = by(rows, key), b = by(rowsPy, key), t = targets ? by(tgtYtd, targets, tval) : new Map()
    const tot = total ?? sum(rows)
    return [...new Set([...a.keys(), ...b.keys()])].map((name) => {
      const v = a.get(name) || 0, p = b.get(name) || 0, tg = t.get(name) || 0
      return { name, v, py: p, growth: p > 0 ? v / p - 1 : null, share: tot ? v / tot : 0, target: tg, ach: tg ? v / tg : null }
    }).filter((g) => Math.abs(g.v) + Math.abs(g.py) > 0.5).sort((x, y) => y.v - x.v)
  }
  const monthly = (rowsAll, year, fn = val) => MONTHS.map((_, i) => sum(rowsAll.filter((r) => r.fy === year && r.m === i + 1), fn))
  const distinctCust = (year, pred = () => true) =>
    new Set(custs.filter((r) => inYtd(r, year) && pred(r) && (r.usd || 0) > 0).map((r) => r.customer_id)).size
  return { fy, py, py2, cur, asof, open, cube, ytd, ytdPy, ytdPy2, tgt, tgtYtd, tgtFull, custs, val, tval, rate, lastRate, sum, by, table, monthly, distinctCust, inYtd }
}

export const growthOf = (v, p) => (p > 0 ? v / p - 1 : null)

// full-year landing: actual to the as-of month + last year's remaining months grown at this year's YTD growth
export function forecast(sc) {
  const { fy, py, asof, cube, sum, val, tgtFull, tval, ytd, ytdPy } = sc
  const g = growthOf(sum(ytd), sum(ytdPy))
  const factor = g == null ? 1 : 1 + Math.max(-0.5, Math.min(1, g))
  const months = MONTHS.map((label, i) => {
    const m = i + 1
    const act = m <= asof ? sum(cube.filter((r) => r.fy === fy && r.m === m)) : null
    const pyv = sum(cube.filter((r) => r.fy === py && r.m === m))
    const fc = m > asof ? pyv * factor : null
    const t = sum(tgtFull.filter((r) => r.m === m), tval)
    return { label, m, actual: act, forecast: fc, py: pyv, target: t || null }
  })
  let ca = 0, ct = 0
  months.forEach((r) => {
    ca += r.actual ?? r.forecast ?? 0; ct += r.target || 0
    r.cumActual = r.m <= asof ? ca : null
    r.cumForecast = r.m >= asof ? ca : null
    r.cumTarget = ct || null
  })
  const actual = sum(ytd)
  const rest = months.filter((r) => r.m > asof).reduce((a, r) => a + (r.forecast || 0), 0)
  const landing = actual + rest
  const fyTarget = sum(tgtFull, tval)
  const left = 12 - asof
  return {
    months, actual, landing, fyTarget, factor, growth: g,
    gap: fyTarget ? fyTarget - landing : null,
    runRate: asof ? actual / asof : 0,
    needed: left > 0 && fyTarget ? Math.max(0, fyTarget - actual) / left : null,
    left,
  }
}
