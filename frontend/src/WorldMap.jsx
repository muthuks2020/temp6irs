import { useMemo, useState } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import world from 'world-atlas/countries-110m.json'
import { money, prettyCountry, signedPct } from './data.js'

// data spelling (upper case, as in the export view) -> map name (Natural Earth 110m)
const ALIAS = {
  'U.A.E.': 'United Arab Emirates', UAE: 'United Arab Emirates', 'U.S.A.': 'United States of America', USA: 'United States of America',
  'UNITED STATES': 'United States of America', 'U.K.': 'United Kingdom', UK: 'United Kingdom', NETHARLANDS: 'Netherlands',
  'D.R.CONGO': 'Dem. Rep. Congo', 'DR CONGO': 'Dem. Rep. Congo', 'DEMOCRATIC REPUBLIC OF THE CONGO': 'Dem. Rep. Congo',
  'IVORY COAST': "Côte d'Ivoire", "COTE D'IVOIRE": "Côte d'Ivoire", "CÔTE D'IVOIRE": "Côte d'Ivoire",
  'TRINIDAD & TOBAGO': 'Trinidad and Tobago', 'BOSNIA AND HERZEGOVINA': 'Bosnia and Herz.', 'DOMINICAN REPUBLIC': 'Dominican Rep.',
  'CENTRAL AFRICAN REPUBLIC': 'Central African Rep.', 'CZECH REPUBLIC': 'Czechia', 'NORTH MACEDONIA': 'Macedonia',
  'SOUTH SUDAN': 'S. Sudan', 'EQUATORIAL GUINEA': 'Eq. Guinea', KOREA: 'South Korea', 'REPUBLIC OF KOREA': 'South Korea',
  'KOREA, REPUBLIC OF': 'South Korea', LAO: 'Laos', "LAO PEOPLE'S DEMOCRATIC REPUBLIC": 'Laos', 'VIET NAM': 'Vietnam',
  SWAZILAND: 'eSwatini', ESWATINI: 'eSwatini', TÜRKIYE: 'Turkey', TURKIYE: 'Turkey', 'RUSSIAN FEDERATION': 'Russia',
  'SYRIAN ARAB REPUBLIC': 'Syria', 'IRAN, ISLAMIC REPUBLIC OF': 'Iran', 'TANZANIA, UNITED REPUBLIC OF': 'Tanzania',
  BURMA: 'Myanmar', 'TIMOR LESTE': 'Timor-Leste', 'STATE OF PALESTINE': 'Palestine', 'REPUBLIC OF THE CONGO': 'Congo',
}

const STEPS = { USD: [50e3, 200e3, 1e6, 5e6], INR: [40e5, 15e6, 8e7, 4e8] }
const LABELS = { USD: ['0 – 50K', '50K – 200K', '200K – 1M', '1M – 5M', '> 5M'], INR: ['< ₹40 L', '₹40 L – 1.5 Cr', '₹1.5 – 8 Cr', '₹8 – 40 Cr', '> ₹40 Cr'] }
export const SHADES = ['#cfe0f7', '#9cc0ee', '#5f97df', '#2c69c4', '#123f8c']
const NODATA = '#e8edf4'

const FEATURES = feature(world, world.objects.countries).features.filter((f) => f.properties.name !== 'Antarctica')
const W = 760, H = 380

export default function WorldMap({ countries, cur, selected, onPick }) {
  const [hover, setHover] = useState(null)
  const [zoom, setZoom] = useState(1)
  const path = useMemo(() => geoPath(geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: 'FeatureCollection', features: FEATURES })), [])
  const byName = useMemo(() => {
    const m = new Map()
    const lower = new Map(FEATURES.map((f) => [f.properties.name.toLowerCase(), f.properties.name]))
    countries.forEach((c) => {
      const name = ALIAS[c.name] || lower.get(c.name.toLowerCase())
      if (name) m.set(name, c)
    })
    return m
  }, [countries])
  const shade = (v) => {
    if (!(v > 0)) return NODATA
    const s = STEPS[cur]
    return SHADES[s.filter((t) => v >= t).length]
  }
  const t = `translate(${(W / 2) * (1 - zoom)} ${(H / 2) * (1 - zoom)}) scale(${zoom})`
  return (
    <div className="map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sales by country" onMouseLeave={() => setHover(null)}>
        <g transform={t}>
          {FEATURES.map((f) => {
            const c = byName.get(f.properties.name)
            const on = selected && c && c.name === selected
            return (
              <path key={f.id || f.properties.name} d={path(f)} fill={shade(c?.v)} stroke={on ? '#0b1f4d' : '#fff'} strokeWidth={(on ? 1.6 : 0.5) / zoom}
                onMouseEnter={() => setHover({ f, c })} onClick={() => c && onPick?.(c.name)} style={{ cursor: c ? 'pointer' : 'default' }} />
            )
          })}
        </g>
      </svg>
      <div className="map-tools">
        <button onClick={() => setZoom((z) => Math.min(4, z * 1.4))} aria-label="Zoom in">+</button>
        <button onClick={() => setZoom((z) => Math.max(1, z / 1.4))} aria-label="Zoom out">−</button>
        <button onClick={() => setZoom(1)} aria-label="Reset zoom">⤢</button>
      </div>
      {hover && (
        <div className="map-tip">
          <b>{hover.c ? prettyCountry(hover.c.name) : hover.f.properties.name}</b>
          {hover.c ? <span>{money(hover.c.v, cur)} · {hover.c.growth == null ? 'new' : `${signedPct(hover.c.growth)} vs PY`}</span> : <span>No sales</span>}
        </div>
      )}
      <div className="map-legend">
        <span className="lg-title">Sales ({cur})</span>
        <span className="lg-item"><i style={{ background: NODATA }} />No data</span>
        {LABELS[cur].map((l, i) => <span key={l} className="lg-item"><i style={{ background: SHADES[i] }} />{l}</span>)}
      </div>
    </div>
  )
}
