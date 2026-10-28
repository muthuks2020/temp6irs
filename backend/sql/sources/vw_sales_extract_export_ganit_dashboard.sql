SELECT DISTINCT ex.tran_date,
    NULL::date AS "Month",
    ex.seller_pan,
    ex.buyer_pan,
    ex.o_type,
    ex.doc_type,
    ex.comp_id::character varying AS comp_id,
    ex.customer_id::character varying AS customer_id,
    ex.product_id::character varying AS product_id,
    'Export'::character varying AS domestic_export,
    ex.inv_number,
    ex.invoice_salesperson,
    ex.customer_sales_executive,
    ex.customer_ref,
    ex.journal_type,
    ex.invoice_line_gl_account,
    ex.invoice_line_label,
    ex.inv_quantity,
    ex.inv_currency,
    ex.inv_unit_price,
    ex.inv_subtotal,
    ex.inv_subtotal_signed,
    ex.inr_subtotal_signed,
        CASE
            WHEN TRIM(BOTH FROM ex.inv_country) = 'United Arab Emirates'::text THEN 'U.A.E.'::text
            ELSE upper(ex.inv_country)
        END AS inv_country,
        CASE
            WHEN TRIM(BOTH FROM ex.inv_country) = 'United Arab Emirates'::text THEN 'U.A.E.'::text
            ELSE upper(ex.inv_country)
        END AS "Country",
    cm.continent,
        CASE
            WHEN ex.customer_id::text = ANY (ARRAY['179011'::character varying::text, '209185'::character varying::text, '178049'::character varying::text, '203983'::character varying::text]) THEN 'SRIDHAR'::character varying
            WHEN ex.customer_id::text = ANY (ARRAY['177942'::character varying::text, '203484'::character varying::text]) THEN 'KUMARAN'::character varying
            WHEN ex.customer_id::text = ANY (ARRAY['180956'::character varying::text, '207186'::character varying::text]) THEN 'RS (Sridhar)'::character varying
            WHEN ex.customer_id::text = '209474'::text THEN 'HARI'::character varying
            ELSE COALESCE(cm.manager, 'Others'::character varying)
        END AS "Manager",
    ex.pincode,
    ex.cust_pincode,
    ex.latitude,
    ex.longitude,
    ex.cust_salesteam,
    ex.cust_division,
    ex.customer_name,
    ex.c1_channel,
    ex.c2_pharma_cat,
    ex.product_name,
    ex.pg1_business_unit,
    ex.pg2_category,
    ex.pg7_sales_category,
    ex.pg8_sales_group,
    ex.unit_price,
    ex.target_qty,
    ex.target_revenue AS "Monthly Target (USD)",
    ex.pg1_primary_category,
    ex.pg2_secondary_category,
    ex.product_tmpl_id,
    ex.product_code,
    ex.product_category_name,
    ex.account_move_line_id,
    ex.display_type,
    ex.grade_type,
    ex.group_customer_no,
    CURRENT_TIMESTAMP AS last_refreshed_at
   FROM ( SELECT DISTINCT se.tran_date,
            se.seller_pan,
            se.buyer_pan,
            se.o_type,
            se.doc_type,
            se.company_id AS comp_id,
            se.billing_customer_id AS customer_id,
            se.product_id,
            se.domestic_export,
            se.inv_number,
            se.account_move_line_id,
            se.invoice_salesperson,
            se.display_type,
                CASE
                    WHEN length(COALESCE(cust.customer_sales_executive_name, ''::text)) = 0 THEN se.invoice_salesperson
                    ELSE cust.customer_sales_executive_name
                END AS customer_sales_executive,
            cust.customer_reference AS customer_ref,
            se.journal_type,
            se.invoice_line_gl_account,
            se.invoice_line_label,
                CASE
                    WHEN se.doc_type = '2Cr_Note'::text THEN '-1.00'::numeric::double precision * se.inv_quantity
                    ELSE se.inv_quantity
                END AS inv_quantity,
            se.inv_currency,
            se.inv_unit_price,
            se.inv_subtotal,
            se.inv_subtotal_signed,
            round(se.inr_subtotal_signed, 0) AS inr_subtotal_signed,
                CASE
                    WHEN se.billing_customer_id::text = ANY (ARRAY['179011'::character varying::text, '209185'::character varying::text]) THEN se.delivery_country
                    WHEN se.billing_customer_id::text = '183689'::text THEN 'Mexico'::text
                    WHEN se.billing_customer_id::text = ANY (ARRAY['184241'::character varying::text, '180144'::character varying::text]) THEN 'Russia'::text
                    WHEN se.billing_customer_id::text = ANY (ARRAY['187860'::character varying::text, '195853'::character varying::text, '154599'::character varying::text, '207565'::character varying::text, '178462'::character varying::text, '204128'::character varying::text, '150951'::character varying::text]) THEN 'U.K.'::text
                    WHEN se.billing_customer_id::text = ANY (ARRAY['178564'::character varying::text, '178322'::character varying::text, '178404'::character varying::text]) THEN 'Venezuela'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'Singapore'::text THEN 'Indonesia'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'Brunei Darussalam'::text THEN 'Brunei'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'Democratic Republic of the Congo'::text THEN 'D.R.Congo'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'Nepal'::text THEN 'Nepal'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'United Kingdom'::text THEN 'U.K.'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'United States'::text THEN 'U.S.A.'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'Netherlands'::text THEN 'Netharlands'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'United Arab Emirates'::text THEN 'U.A.E.'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'Côte d''Ivoire'::text THEN 'Ivory Coast'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'State of Palestine'::text THEN 'Palestine'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'Trinidad and Tobago'::text THEN 'Trinidad & Tobago'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'NEPAL'::text THEN 'Nepal'::text
                    WHEN TRIM(BOTH FROM se.inv_country) = 'USA'::text THEN 'U.S.A.'::text
                    ELSE TRIM(BOTH FROM se.inv_country)
                END AS inv_country,
            cust.customer_zip AS pincode,
            cust.customer_zip AS cust_pincode,
            cust.bill_to_latitude AS latitude,
            cust.bill_to_longitude AS longitude,
            cust.cust_salesteam,
            cust.cust_division,
            cust.customer_name,
            cust.grade_type,
            cust.group_customer_no,
            COALESCE(cust.c1_channel, 'OTHERS'::character varying::text) AS c1_channel,
            COALESCE(cust.c2_pharma_cat, 'OTHERS'::character varying::text) AS c2_pharma_cat,
            se.product_name,
            COALESCE(pr.product_segment, 'OTHERS'::character varying::text) AS pg1_business_unit,
            COALESCE(pr.product_sub_group, 'OTHERS'::text) AS pg2_category,
            COALESCE(pr.product_family, 'OTHERS'::character varying::text) AS pg7_sales_category,
                CASE
                    WHEN COALESCE(pr.product_family, 'OTHERS'::character varying::text) = 'OTHER EQUIPMENT'::text THEN 'OTHER EQUIPMENT'::character varying::text
                    ELSE COALESCE(pr.product_group, 'OTHERS'::character varying::text)
                END AS pg8_sales_group,
            NULL::integer AS unit_price,
            NULL::integer AS target_qty,
            NULL::double precision AS target_revenue,
            cust.pg1_primary_category,
            cust.pg2_secondary_category,
            pr.product_template_id AS product_tmpl_id,
            se.product_code,
            pr.product_category_name
           FROM gold.sales_mart se
             LEFT JOIN gold.customer_datamart cust ON se.billing_customer_id::text = cust.customer_id::text
             LEFT JOIN gold.product_mart pr ON se.product_id = pr.product_id
          WHERE (se.code_prefix_end = ANY (ARRAY['410'::character varying::text, '411'::character varying::text, '413'::character varying::text, '415'::character varying::text, '532'::character varying::text])) AND se.tran_date < CURRENT_DATE AND (se.domestic_export = 'Export'::text OR (se.billing_customer_id::text = ANY (ARRAY['180144'::character varying::text, '184241'::character varying::text, '166695'::character varying::text, '200757'::character varying::text, '201537'::character varying::text]))) AND (se.domestic_export = 'Export'::text OR (se.delivery_customer_id::text = ANY (ARRAY['180144'::character varying::text, '184241'::character varying::text, '166695'::character varying::text, '200757'::character varying::text, '201537'::character varying::text]))) AND (se.billing_customer_id::text <> ALL (ARRAY['167094'::character varying::text, '178086'::character varying::text])) AND (se.delivery_customer_id::text <> ALL (ARRAY['167094'::character varying::text, '178086'::character varying::text]))) ex
     LEFT JOIN ( SELECT DISTINCT e.country,
            e.manager,
            e.continent
           FROM silver_static.export_target e) cm ON upper(cm.country::text) = upper(ex.inv_country)
UNION
 SELECT DISTINCT NULL::date AS tran_date,
    et.month AS "Month",
    NULL::character varying AS seller_pan,
    NULL::character varying AS buyer_pan,
    NULL::character varying AS o_type,
    NULL::character varying AS doc_type,
    NULL::character varying AS comp_id,
    NULL::character varying AS customer_id,
    NULL::character varying AS product_id,
    'Export'::character varying AS domestic_export,
    NULL::character varying AS inv_number,
    NULL::character varying AS invoice_salesperson,
    NULL::character varying AS customer_sales_executive,
    NULL::character varying AS customer_ref,
    NULL::character varying AS journal_type,
    NULL::character varying AS invoice_line_gl_account,
    NULL::character varying AS invoice_line_label,
    NULL::double precision AS inv_quantity,
    NULL::character varying AS inv_currency,
    NULL::double precision AS inv_unit_price,
    NULL::double precision AS inv_subtotal,
    NULL::double precision AS inv_subtotal_signed,
    NULL::numeric AS inr_subtotal_signed,
    upper(et.country::text) AS inv_country,
    upper(et.country::text) AS "Country",
    et.continent,
    et.manager AS "Manager",
    NULL::character varying AS pincode,
    NULL::character varying AS cust_pincode,
    NULL::character varying AS latitude,
    NULL::character varying AS longitude,
    NULL::character varying AS cust_salesteam,
    NULL::character varying AS cust_division,
    NULL::character varying AS customer_name,
    NULL::character varying AS c1_channel,
    NULL::character varying AS c2_pharma_cat,
    NULL::text AS product_name,
    NULL::character varying AS pg1_business_unit,
    NULL::text AS pg2_category,
    NULL::character varying AS pg7_sales_category,
    NULL::character varying AS pg8_sales_group,
    NULL::integer AS unit_price,
    NULL::integer AS target_qty,
    et.monthly_target_usd AS "Monthly Target (USD)",
    NULL::character varying AS pg1_primary_category,
    NULL::character varying AS pg2_secondary_category,
    NULL::integer AS product_tmpl_id,
    NULL::text AS product_code,
    NULL::character varying AS product_category_name,
    0 AS account_move_line_id,
    NULL::text AS display_type,
    NULL::text AS grade_type,
    NULL::text AS group_customer_no,
    CURRENT_TIMESTAMP AS last_refreshed_at
   FROM silver_static.export_target et
