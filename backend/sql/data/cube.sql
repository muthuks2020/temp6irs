-- Sales cube: fiscal year x month x region x country x class x segment x family x brand.
-- "early" (only in the month of the latest invoice) = invoice day <= latest invoice day, for a like-for-like
-- comparison of the open month with the same days last year.
SELECT fy, m, CASE WHEN m = %(cut_m)s THEN dd <= %(cut_day)s END AS early, region, country, cls, segment, family, brand,
       round(sum(amt_usd)) AS usd, round(sum(amt_inr)) AS inr, round(sum(qty)) AS qty
FROM intl_lines
WHERE fy IN (%(fy)s, %(prev_fy)s, %(prev2_fy)s)
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
HAVING sum(amt_inr) <> 0
