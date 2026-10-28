-- Monthly export targets in USD by country (silver_static.export_target via the same gold view).
SELECT concat('FY', lpad(mod(t.fy_start, 100)::text, 2, '0'), '_', lpad(mod(t.fy_start + 1, 100)::text, 2, '0')) AS fy,
       t.m, t.country, t.region, t.manager, sum(t.target_usd) AS target_usd
FROM (
    SELECT (extract(year FROM s."Month"::date - interval '3 months'))::int AS fy_start,
           mod(extract(month FROM s."Month"::date)::int + 8, 12) + 1      AS m,
           upper(trim(COALESCE(NULLIF(trim(s."Country"), ''), NULLIF(trim(s.inv_country), ''), 'UNASSIGNED'))) AS country,
           COALESCE(NULLIF(trim(s.continent), ''), 'Unassigned')          AS region,
           COALESCE(NULLIF(trim(s."Manager"), ''), 'Others')              AS manager,
           s."Monthly Target (USD)"::numeric                              AS target_usd
    FROM {{export}} s
    WHERE s.tran_date IS NULL AND s."Month" IS NOT NULL AND COALESCE(s."Monthly Target (USD)", 0) <> 0
) t
GROUP BY 1, 2, 3, 4, 5
