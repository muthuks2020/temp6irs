SELECT fy, m, region, country, round(sum(target_usd), 2) AS target_usd
FROM intl_targets
WHERE fy IN (%(fy)s, %(prev_fy)s)
GROUP BY 1, 2, 3, 4
