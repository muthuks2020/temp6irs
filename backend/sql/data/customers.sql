-- Billed customers (distributors) per month and country, for "active distributors" counts.
SELECT fy, m, CASE WHEN m = %(cut_m)s THEN dd <= %(cut_day)s END AS early, region, country, customer_id, round(sum(amt_usd)) AS usd
FROM intl_lines
WHERE fy IN (%(fy)s, %(prev_fy)s, %(prev2_fy)s) AND customer_id IS NOT NULL
GROUP BY 1, 2, 3, 4, 5, 6
HAVING sum(amt_inr) > 0
