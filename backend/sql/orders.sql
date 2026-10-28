-- Open export sale orders (Odoo): value still to invoice in INR, by order, country, status, segment.
-- Same rule as the Iris open-orders tile: confirmed or awaiting-approval orders since 1 Apr 2025,
-- not fully invoiced, product lines only (no notes / sections / down payments), shipped outside India.
WITH ol AS (
    SELECT so.id, so.name::text AS order_no, so.date_order::date AS order_date,
           COALESCE(so.state::text, '') AS state, COALESCE(so.delivery_status::text, '') AS delivery_status,
           COALESCE(shp.customer_name, cust.customer_name)::text AS customer,
           upper(trim(COALESCE(NULLIF(trim(shp.country::text), ''), NULLIF(trim(cust.country::text), ''), 'INDIA'))) AS country_raw,
           COALESCE(NULLIF(trim(pms.product_segment::text), ''), 'Unassigned') AS segment,
           (COALESCE(sol.price_subtotal, 0) - COALESCE(sol.untaxed_amount_invoiced, 0))
             / COALESCE(NULLIF(so.currency_rate, 0), 1) AS pending_inr,
           COALESCE(sol.untaxed_amount_invoiced, 0) AS invoiced
    FROM silver.odoo_sale_order so
    JOIN silver.odoo_sale_order_line sol     ON so.id = sol.order_id
    LEFT JOIN gold.product_mart pms          ON sol.product_id = pms.product_id
    LEFT JOIN gold.customer_datamart cust    ON so.partner_id = cust.customer_id
    LEFT JOIN gold.customer_datamart shp     ON so.partner_shipping_id = shp.customer_id
    WHERE so.date_order >= TIMESTAMP '2025-04-01 00:00:00'
      AND COALESCE(so.state, '') NOT IN ('draft', 'sent', 'cancel')
      AND COALESCE(so.invoice_status, '') <> 'invoiced'
      AND sol.display_type IS NULL
      AND COALESCE(sol.is_downpayment, false) = false
),
st AS (
    SELECT id,
           CASE WHEN max(state) NOT IN ('sale', 'done') THEN 'Awaiting approval'
                WHEN sum(invoiced) > 0 OR max(delivery_status) IN ('partial', 'started') THEN 'Approved - partly dispatched'
                ELSE 'Approved - not dispatched' END AS status
    FROM ol GROUP BY id
)
SELECT ol.order_no, ol.order_date, max(ol.customer) AS customer,
       CASE ol.country_raw WHEN 'UNITED ARAB EMIRATES' THEN 'U.A.E.' WHEN 'UNITED STATES' THEN 'U.S.A.'
            WHEN 'USA' THEN 'U.S.A.' WHEN 'UNITED KINGDOM' THEN 'U.K.' WHEN 'NETHERLANDS' THEN 'NETHARLANDS'
            WHEN 'DEMOCRATIC REPUBLIC OF THE CONGO' THEN 'D.R.CONGO' WHEN 'CÔTE D''IVOIRE' THEN 'IVORY COAST'
            ELSE ol.country_raw END AS country,
       st.status, ol.segment, round(sum(ol.pending_inr)) AS pending_inr
FROM ol JOIN st ON st.id = ol.id
WHERE ol.country_raw <> 'INDIA'
GROUP BY ol.order_no, ol.order_date, ol.country_raw, st.status, ol.segment
HAVING sum(ol.pending_inr) > 0
