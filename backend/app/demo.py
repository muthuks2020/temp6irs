"""Sample data for testing the screens without a database (demo_mode = true only).
Every figure and name here is invented; the screen shows a SAMPLE DATA banner."""
import datetime as dt
import random

REGIONS = {
    "Europe": ["GERMANY", "ITALY", "SPAIN", "U.K.", "FRANCE", "POLAND", "NETHARLANDS", "GREECE", "PORTUGAL", "ROMANIA"],
    "Asia Pacific": ["INDONESIA", "PHILIPPINES", "VIETNAM", "THAILAND", "MALAYSIA", "AUSTRALIA", "JAPAN", "SOUTH KOREA", "CHINA"],
    "Middle East & Africa": ["SAUDI ARABIA", "U.A.E.", "EGYPT", "KENYA", "NIGERIA", "SOUTH AFRICA", "IRAQ", "JORDAN", "ETHIOPIA",
                             "TANZANIA", "D.R.CONGO", "IVORY COAST", "GHANA"],
    "Latin America": ["BRAZIL", "MEXICO", "COLOMBIA", "PERU", "CHILE", "ARGENTINA", "ECUADOR"],
    "North America": ["U.S.A.", "CANADA"],
    "SAARC": ["BANGLADESH", "NEPAL", "SRI LANKA", "BHUTAN", "AFGHANISTAN"],
    "CIS": ["RUSSIA", "KAZAKHSTAN", "UZBEKISTAN", "UKRAINE"],
}
CATALOG = [  # cls, segment, family, brand, weight
    ("Consumables", "IOL", "Foldable IOL", "Hydrophobic IOL", 14), ("Consumables", "IOL", "Foldable IOL", "Hydrophilic IOL", 10),
    ("Consumables", "IOL", "Rigid IOL", "PMMA IOL", 6), ("Consumables", "IOL", "Premium IOL", "Toric IOL", 4),
    ("Consumables", "OVD", "OVD", "HPMC OVD", 7), ("Consumables", "OVD", "OVD", "Hyaluronate OVD", 6),
    ("Consumables", "MSI", "Surgical instruments", "Ophthalmic knives", 6), ("Consumables", "MSI", "Surgical instruments", "Sutures", 4),
    ("Consumables", "PHARMA", "Eye drops", "Eye drops", 5), ("Consumables", "OTHERS", "Disposables", "Surgical drapes", 4),
    ("Equipment", "EQUIPMENT", "Phaco systems", "Phaco system", 7), ("Equipment", "EQUIPMENT", "Operating microscopes", "Operating microscope", 5),
    ("Equipment", "EQUIPMENT", "Diagnostics", "Auto refractometer", 3), ("Equipment", "EQUIPMENT", "Diagnostics", "Slit lamp", 3),
    ("Equipment", "EQUIPMENT", "Lasers", "YAG laser", 2),
    ("Service", "SPARES & SERVICE", "Spares", "Spares", 1),
]


def _fy_start(fy):
    return 2000 + int(fy[2:4])


def bundle(fy: str) -> dict:
    rnd = random.Random(fy)
    today = dt.date.today() - dt.timedelta(days=1)
    start = _fy_start(fy)
    cur_fy = f"FY{(today.year if today.month >= 4 else today.year - 1) % 100:02d}_{((today.year if today.month >= 4 else today.year - 1) + 1) % 100:02d}"
    last_m = ((today.month + 8) % 12) + 1 if fy == cur_fy else 12
    cut_day = today.day if fy == cur_fy else 31
    fys = [fy, f"FY{(start - 1) % 100:02d}_{start % 100:02d}", f"FY{(start - 2) % 100:02d}_{(start - 1) % 100:02d}"]
    cube, targets, customers, rates = [], [], [], []
    size = {c: rnd.uniform(0.2, 1.0) ** 2 for cs in REGIONS.values() for c in cs}
    for big in ("SAUDI ARABIA", "BRAZIL", "INDONESIA", "U.A.E.", "EGYPT", "MEXICO", "PHILIPPINES", "GERMANY"):
        size[big] = rnd.uniform(1.6, 2.6)
    for k, f in enumerate(fys):
        growth = 1 / (1.13 ** k)
        months = last_m if k == 0 else 12
        for m in range(1, months + 1):
            rate = 82 + 0.18 * (12 * (2 - k) + m) + rnd.uniform(-0.3, 0.3)
            rates.append([f, m, round(rate, 4)])
            season = 1 + 0.18 * ((m % 12) in (9, 10, 11, 12)) - 0.08 * (m in (1, 2))
            for region, countries in REGIONS.items():
                for c in countries:
                    base = 95000 * size[c] * growth * season
                    for cls, seg, fam, brand, w in CATALOG:
                        if rnd.random() < 0.35:
                            continue
                        usd = base * w / 20 * rnd.uniform(0.4, 1.6)
                        split = m == last_m
                        early = usd * min(1, cut_day / 30) if split else usd
                        for flag, val in ((((True, early),) if k == 0 else ((True, early), (False, usd - early))) if split else ((None, usd),)):
                            if val > 1:
                                cube.append([f, m, flag, region, c, cls, seg, fam, brand, round(val), round(val * rate),
                                             round(val / (900 if cls == "Equipment" else 18))])
                    for j in range(1 + int(size[c] * 4)):
                        if rnd.random() < 0.75:
                            customers.append([f, m, (True if m == last_m else None), region, c, f"{c[:3]}-{j}", round(base / 3)])
                    if k <= 1:
                        targets.append([f, m, region, c, round(base * 2.95 * (1.08 if k == 0 else 1.02), 2)])
        if k == 0:  # full-year targets for the open year
            for m in range(months + 1, 13):
                for region, countries in REGIONS.items():
                    for c in countries:
                        targets.append([f, m, region, c, round(95000 * size[c] * 3.2, 2)])
    managers = {"Europe": "Manager A", "Asia Pacific": "Manager B", "Middle East & Africa": "Manager C",
                "Latin America": "Manager D", "North America": "Manager A", "SAARC": "Manager E", "CIS": "Manager E"}
    countries = [[c, r, managers[r]] for r, cs in REGIONS.items() for c in cs]
    orders = []
    statuses = ["Approved - not dispatched", "Approved - partly dispatched", "Awaiting approval"]
    for i in range(140):
        region = rnd.choice(list(REGIONS))
        c = rnd.choice(REGIONS[region])
        seg = rnd.choice(["IOL", "IOL", "OVD", "MSI", "EQUIPMENT", "EQUIPMENT", "PHARMA"])
        age = int(rnd.expovariate(1 / 45))
        orders.append([f"SO/EX/{24000 + i}", (today - dt.timedelta(days=age)).isoformat(), f"Distributor {c.title()} {i % 3 + 1}",
                       c, rnd.choices(statuses, weights=[5, 3, 2])[0], seg, round(rnd.uniform(2, 60) * 1e5 * size[c])])
    last = today if fy == cur_fy else dt.date(start + 1, 3, 31)
    return {
        "meta": {"mode": "demo", "fy": fy, "prev_fy": fys[1], "prev2_fy": fys[2], "last_invoice": last.isoformat(),
                 "cut_day": cut_day, "cut_m": last_m, "fiscal_years": [cur_fy, fys[1] if fy == cur_fy else fy],
                 "generated_at": dt.datetime.now().isoformat(timespec="seconds"), "seconds": 0},
        "cube": {"cols": ["fy", "m", "early", "region", "country", "cls", "segment", "family", "brand", "usd", "inr", "qty"], "rows": cube},
        "targets": {"cols": ["fy", "m", "region", "country", "target_usd"], "rows": targets},
        "customers": {"cols": ["fy", "m", "early", "region", "country", "customer_id", "usd"], "rows": customers},
        "rates": {"cols": ["fy", "m", "usd_inr"], "rows": rates},
        "countries": {"cols": ["country", "region", "manager"], "rows": countries},
        "orders": {"cols": ["order_no", "order_date", "customer", "country", "status", "segment", "pending_inr"], "rows": orders},
    }
