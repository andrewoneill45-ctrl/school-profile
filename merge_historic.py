#!/usr/bin/env python3
"""
Merge historic KS4 (3 years) and KS2 (2 years) into schools.json
Adds trend arrays: ks4_trend and ks2_trend per school
Run: python3 merge_historic.py
"""
import csv, json, os

SCHOOLS = os.path.expanduser('~/school-profile/src/schools.json')
# Current year (2024/25)
KS4_CURRENT = os.path.expanduser('~/Desktop/england_ks4revised.csv')
KS2_CURRENT = os.path.expanduser('~/Desktop/england_ks2revised.csv')
# Historic
KS4_2223 = os.path.expanduser('~/Desktop/Historic Results/england_ks4final 2022:23.csv')
KS4_2122 = os.path.expanduser('~/Desktop/Historic Results/2021-2022_england_ks4final.csv')
KS2_2223 = os.path.expanduser('~/Desktop/Historic Results/england_ks2final 2022:23.csv')

SKIP = {'', 'SUPP', 'NE', 'NA', 'NEW', 'x', 'DNS', 'LOWCOV', 'SP', 'N/A', '-'}

def sf(val):
    if val is None: return None
    val = str(val).strip().replace('%', '').replace(',', '')
    if val.upper() in SKIP: return None
    try: return float(val)
    except: return None

def r(v, dp=1):
    if v is None: return None
    return round(v, dp)

def read_ks4(path, label):
    """Extract key KS4 metrics per URN"""
    data = {}
    with open(path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if str(row.get('RECTYPE','')).strip() != '1': continue
            urn = str(row.get('URN','')).strip()
            if not urn: continue
            a8 = sf(row.get('ATT8SCR'))
            p8 = sf(row.get('P8MEA'))
            b94 = sf(row.get('PTL2BASICS_94'))
            b95 = sf(row.get('PTL2BASICS_95'))
            fsm = sf(row.get('PTFSM6CLA1A'))
            a8d = sf(row.get('ATT8SCR_FSM6CLA1A'))
            a8nd = sf(row.get('ATT8SCR_NFSM6CLA1A'))
            if a8 is not None or p8 is not None or b94 is not None:
                data[urn] = {
                    'year': label,
                    'a8': r(a8), 'p8': r(p8, 2),
                    'b94': r(b94, 0), 'b95': r(b95, 0),
                    'fsm': r(fsm), 'a8d': r(a8d), 'a8nd': r(a8nd)
                }
    return data

def read_ks2(path, label):
    """Extract key KS2 metrics per URN"""
    data = {}
    with open(path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if str(row.get('RECTYPE','')).strip() != '1': continue
            urn = str(row.get('URN','')).strip()
            if not urn: continue
            rwm = sf(row.get('PTRWM_EXP'))
            rwmh = sf(row.get('PTRWM_HIGH'))
            rdavg = sf(row.get('READ_AVERAGE'))
            rdexp = sf(row.get('PTREAD_EXP'))
            matexp = sf(row.get('PTMAT_EXP'))
            writexp = sf(row.get('PTWRITTA_EXP'))
            if rwm is not None or rdavg is not None:
                data[urn] = {
                    'year': label,
                    'rwm': r(rwm, 0), 'rwmh': r(rwmh, 0),
                    'rd': r(rdavg), 'rdexp': r(rdexp, 0),
                    'mat': r(matexp, 0), 'writ': r(writexp, 0)
                }
    return data

print("Loading schools.json...")
with open(SCHOOLS) as f:
    schools = json.load(f)
print(f"  {len(schools)} schools")

by_urn = {str(s['urn']).strip(): s for s in schools}

# ── Read all KS4 years ─────────────────────────
print("\nReading KS4 2021/22...")
ks4_2122 = read_ks4(KS4_2122, '2021/22')
print(f"  {len(ks4_2122)} schools")

print("Reading KS4 2022/23...")
ks4_2223 = read_ks4(KS4_2223, '2022/23')
print(f"  {len(ks4_2223)} schools")

# 2023/24 comes from _PREV columns in the current file
print("Reading KS4 2023/24 (from PREV columns)...")
ks4_2324 = {}
with open(KS4_CURRENT, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if str(row.get('RECTYPE','')).strip() != '1': continue
        urn = str(row.get('URN','')).strip()
        a8 = sf(row.get('ATT8SCR_PREV'))
        p8 = sf(row.get('P8MEA_PREV'))
        b94 = sf(row.get('PTL2BASICS_94_PREV'))
        b95 = sf(row.get('PTL2BASICS_95_PREV'))
        fsm = sf(row.get('PTFSM6CLA1A_PREV'))
        a8d = sf(row.get('ATT8SCR_FSM6CLA1A_PREV'))
        a8nd = sf(row.get('ATT8SCR_NFSM6CLA1A_PREV'))
        if a8 is not None or p8 is not None or b94 is not None:
            ks4_2324[urn] = {
                'year': '2023/24', 'a8': r(a8), 'p8': r(p8, 2),
                'b94': r(b94, 0), 'b95': r(b95, 0),
                'fsm': r(fsm), 'a8d': r(a8d), 'a8nd': r(a8nd)
            }
print(f"  {len(ks4_2324)} schools")

# 2024/25 from current data already in schools.json
print("Reading KS4 2024/25 (current)...")
ks4_2425 = read_ks4(KS4_CURRENT, '2024/25')
print(f"  {len(ks4_2425)} schools")

# ── Read all KS2 years ─────────────────────────
print("\nReading KS2 2022/23...")
ks2_2223 = read_ks2(KS2_2223, '2022/23')
print(f"  {len(ks2_2223)} schools")

# 2023/24 from _24 columns in current file
print("Reading KS2 2023/24 (from _24 columns)...")
ks2_2324 = {}
with open(KS2_CURRENT, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if str(row.get('RECTYPE','')).strip() != '1': continue
        urn = str(row.get('URN','')).strip()
        rwm = sf(row.get('PTRWM_EXP_24'))
        rwmh = sf(row.get('PTRWM_HIGH_24'))
        rdavg = sf(row.get('READ_AVERAGE_24'))
        if rwm is not None or rdavg is not None:
            ks2_2324[urn] = {
                'year': '2023/24', 'rwm': r(rwm, 0), 'rwmh': r(rwmh, 0),
                'rd': r(rdavg)
            }
print(f"  {len(ks2_2324)} schools")

# 2024/25 from current
print("Reading KS2 2024/25 (current)...")
ks2_2425 = read_ks2(KS2_CURRENT, '2024/25')
print(f"  {len(ks2_2425)} schools")

# ── Build trend arrays ─────────────────────────
print("\nBuilding trends...")
ks4_count = 0
ks2_count = 0

for urn, s in by_urn.items():
    # KS4 trend (up to 4 years)
    trend4 = []
    for src in [ks4_2122, ks4_2223, ks4_2324, ks4_2425]:
        if urn in src:
            entry = {k: v for k, v in src[urn].items() if v is not None}
            if len(entry) > 1:  # more than just 'year'
                trend4.append(entry)
    if len(trend4) >= 2:
        s['ks4_trend'] = trend4
        ks4_count += 1

    # KS2 trend (up to 3 years)
    trend2 = []
    for src in [ks2_2223, ks2_2324, ks2_2425]:
        if urn in src:
            entry = {k: v for k, v in src[urn].items() if v is not None}
            if len(entry) > 1:
                trend2.append(entry)
    if len(trend2) >= 2:
        s['ks2_trend'] = trend2
        ks2_count += 1

print(f"  {ks4_count} schools with KS4 trend (2+ years)")
print(f"  {ks2_count} schools with KS2 trend (2+ years)")

# ── Save ───────────────────────────────────────
print(f"\nSaving...")
with open(SCHOOLS, 'w') as f:
    json.dump(schools, f)

size_mb = os.path.getsize(SCHOOLS) / 1024 / 1024
print(f"\n{'='*45}")
print(f"  File size: {size_mb:.1f} MB")
print(f"  KS4 trends: {ks4_count:,}")
print(f"  KS2 trends: {ks2_count:,}")

# Sample output
for s in schools:
    if s.get('ks4_trend') and len(s['ks4_trend']) >= 3:
        print(f"\n  Sample KS4: {s['name']}")
        for t in s['ks4_trend']:
            print(f"    {t}")
        break
for s in schools:
    if s.get('ks2_trend') and len(s['ks2_trend']) >= 2:
        print(f"\n  Sample KS2: {s['name']}")
        for t in s['ks2_trend']:
            print(f"    {t}")
        break

print(f"\n{'='*45}")
print("Done! Restart dev server.")
