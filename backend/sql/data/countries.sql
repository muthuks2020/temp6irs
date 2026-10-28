-- Country master for the dashboard: region and export manager (from the export target master,
-- else the most frequent value on the invoices).
SELECT country,
       (array_agg(region  ORDER BY src, n DESC))[1] AS region,
       (array_agg(manager ORDER BY src, n DESC))[1] AS manager
FROM (
    SELECT country, region, manager, 1 AS src, count(*) AS n FROM intl_targets GROUP BY 1, 2, 3
    UNION ALL
    SELECT country, region, manager, 2 AS src, count(*) AS n FROM intl_lines GROUP BY 1, 2, 3
) x
GROUP BY country
