# Iris International – export business dashboard

A separate project from **Iris** (group sales dashboard). It has its own folder, code, settings file,
environment variables (`INTL_DB_*`) and port (**8020**). Nothing here reads or changes the Iris folder,
and Iris keeps running on port 8010 as before.

Version 1.1 – six pages:

| Page | What it answers |
| --- | --- |
| Executive Summary | the wireframe: KPIs, product mix, world map, regions, trend, top countries and brands |
| Product Performance | class tiles, segment table (units, average price), change vs PY, monthly mix, segment × region, family and brand drill |
| Regional Performance | region tiles with target bar and trend, month by month vs PY and target, product mix by region, export managers, quarterly growth, countries of the region |
| Country Performance | active / new / lost countries, sortable searchable country table, size vs growth, country detail (trend, segments, brands) |
| Brands Performance | class filter, brand table (units, countries), brand trend, gainers and decliners, brand × region |
| Forecast & Pipeline | full-year landing vs target, run-rate needed, cumulative chart, landing by region, open export orders by status, age, country and the largest orders |

## What it shows

| Area | Content |
| --- | --- |
| Filters | Fiscal year, As of (month end, or the latest invoice date for the open month), Region, Country, Currency (USD / INR) |
| KPI tiles | Net sales YTD vs PY, Growth vs PY (and last year's growth), Target achievement, Consumables sales, Equipment sales, Active countries, Active distributors |
| Product mix | Consumables by segment (IOL, OVD, MSI …), Equipment by product family |
| Map | Sales by country, 5 colour bands; click a country to filter |
| Regional summary | Sales, PY, growth, target, achievement by region (continent from the export target master) |
| Sales trend | Monthly actual vs PY vs target |
| Top 10 countries | Sales, PY, growth, achievement |
| Top brands | Consumables and equipment product groups with growth and mix |

## Data (read-only)

* `gold.vw_sales_extract_export_ganit_dashboard` – export invoice lines (the same view Tableau and Iris read)
* `silver_static.export_target` (through the same view) – monthly targets in USD by country, region, manager
* USD = invoice amount when invoiced in USD; any other currency = INR value / that month's average USD rate
* Equipment = segment containing "equip" or "accessor"; Service = "service" or "spare"; the rest = Consumables
* Open month: last year is cut to the same days (like for like)

One refresh reads the view once into a session TEMP table (dropped at commit – nothing is created in gold),
then runs 5 small queries. The browser gets one compact bundle per fiscal year and applies every filter
itself, so filter changes are instant. Results are cached for 60 minutes and pre-loaded in the background.
`/api/sql` shows every statement for checking in DBeaver.

## First-time setup (Windows)

```
cd C:\Users\DavidM\Downloads\ceo_dashboard\iris_international\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

`backend\config\database.ini` holds the connection (copy `database.ini.example` if it is missing).

## Run

```
cd C:\Users\DavidM\Downloads\ceo_dashboard\iris_international\backend
.\.venv\Scripts\python.exe run.py
```

Open http://localhost:8020 . For other PCs set `[server] host = 0.0.0.0` and allow port 8020 in the firewall.

## Rebuild the screens (only after changing frontend\src)

```
cd ..\frontend
npm install
npm run build
```

## Files

```
backend/
  app/main.py        API, refresh job, cache
  app/config.py      reads config/database.ini (INTL_DB_* overrides)
  app/demo.py        sample data for testing (demo_mode = true only)
  sql/intl_lines.sql export lines + USD conversion + class
  sql/intl_targets.sql
  sql/data/*.sql     cube, targets, customers, rates, countries (region + manager)
  sql/orders.sql     open export sale orders from Odoo (silver), optional
  sql/sources/       fallback SQL of the export view (used only if the view is missing)
frontend/
  src/App.jsx        header, menu, filters, page switching
  src/pages/*.jsx    one file per page
  src/ui.jsx         shared tiles, cards, tables
  src/data.js        all calculations and filters
  src/WorldMap.jsx   world map (Natural Earth 110m, bundled – no internet needed)
  dist/              built site served by the backend
```
