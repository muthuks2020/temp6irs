-- Average USD/INR rate per fiscal month (used to show targets in INR).
SELECT fy, m, round(avg(usd_inr), 4) AS usd_inr
FROM intl_lines
WHERE fy IN (%(fy)s, %(prev_fy)s, %(prev2_fy)s)
GROUP BY 1, 2
