-- Iris International: one row per export invoice line, with fiscal period, region and USD value.
-- Source: gold.vw_sales_extract_export_ganit_dashboard (same view Tableau reads), read-only.
--   * USD  : invoice amount when the invoice is in USD; otherwise the INR value / that month's
--            average USD rate (taken from the USD invoices of the same month)
--   * class: Equipment (equipment, accessories), Service (service, spares), Consumables (the rest)
WITH src AS (
    SELECT * FROM {{export}} s
    WHERE s.tran_date IS NOT NULL AND s.tran_date >= DATE '2023-04-01' AND s.tran_date < CURRENT_DATE
),
lines AS (
    SELECT s.tran_date::date                                                             AS d,
           (extract(year FROM s.tran_date::date - interval '3 months'))::int             AS fy_start,
           mod(extract(month FROM s.tran_date)::int + 8, 12) + 1                         AS m,
           extract(day FROM s.tran_date)::int                                            AS dd,
           upper(trim(COALESCE(NULLIF(trim(s."Country"), ''), NULLIF(trim(s.inv_country), ''), 'UNASSIGNED'))) AS country,
           COALESCE(NULLIF(trim(s.continent), ''), 'Unassigned')                         AS region,
           COALESCE(NULLIF(trim(s."Manager"), ''), 'Others')                             AS manager,
           s.customer_id::text                                                           AS customer_id,
           COALESCE(NULLIF(trim(s.pg1_business_unit), ''), 'Unassigned')                AS segment,
           COALESCE(NULLIF(trim(s.pg7_sales_category), ''), 'Unassigned')               AS family,
           COALESCE(NULLIF(trim(s.pg8_sales_group), ''), NULLIF(trim(s.pg7_sales_category), ''), 'Unassigned') AS brand,
           upper(COALESCE(s.inv_currency, ''))                                           AS cur,
           COALESCE(s.inv_subtotal_signed, 0)::numeric                                   AS amt_doc,
           COALESCE(s.inr_subtotal_signed, 0)::numeric                                   AS amt_inr,
           COALESCE(s.inv_quantity, 0)::numeric                                          AS qty
    FROM src s
),
rates AS (
    SELECT date_trunc('month', d)::date AS mon, sum(amt_inr) / NULLIF(sum(amt_doc), 0) AS usd_inr
    FROM lines WHERE cur = 'USD' AND amt_doc <> 0
    GROUP BY 1 HAVING sum(amt_doc) > 0
)
SELECT l.*,
       concat('FY', lpad(mod(l.fy_start, 100)::text, 2, '0'), '_', lpad(mod(l.fy_start + 1, 100)::text, 2, '0')) AS fy,
       CASE WHEN l.segment ~* 'equip|accessor' THEN 'Equipment'
            WHEN l.segment ~* 'service|spare'  THEN 'Service'
            ELSE 'Consumables' END                                                        AS cls,
       COALESCE(r.usd_inr, (SELECT avg(usd_inr) FROM rates), 83)                          AS usd_inr,
       CASE WHEN l.cur = 'USD' THEN l.amt_doc
            ELSE l.amt_inr / NULLIF(COALESCE(r.usd_inr, (SELECT avg(usd_inr) FROM rates), 83), 0) END AS amt_usd
FROM lines l
LEFT JOIN rates r ON r.mon = date_trunc('month', l.d)::date
