SELECT max(d) AS last_invoice, array_agg(DISTINCT fy ORDER BY fy DESC) AS fiscal_years FROM intl_lines
