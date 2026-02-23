#!/usr/bin/env python3
"""
Merge DfE KS4 and KS2 performance data into schools.json
Handles values with % signs, NA, SUPP, NE etc.
"""
import csv
import json
import os

SCHOOLS_PATH = os.path.expanduser('~/school-profile/src/schools.json')
KS4_PATH = os.path.expanduser('~/Desktop/england_ks4revised.csv')
KS2_PATH = os.path.expanduser('~/Desktop/england_ks2revised.csv')
OUTPUT_PATH = os.path.expanduser('~/school-profile/src/schools.json')

SKIP = {'', 'SUPP', 'NE', 'NA', 'NEW', 'x', 'DNS', 'LOWCOV', 'SP', 'N/A', '-'}

def safe_float(val):
    if val is None:
        return None
    val = str(val).strip().replace('%', '').replace(',', '')
    if val.upper() in SKIP:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None

def put(school, key, row, col, decimals=1):
    v = safe_float(row.get(col))
    if v is not None:
        school[key] = round(v, decimals)
        return True
    return False

print("Loading schools.json...")
with open(SCHOOLS_PATH, 'r') as f:
    schools = json.load(f)
print(f"  Loaded {len(schools)} schools")

by_urn = {}
for s in schools:
    by_urn[str(s['urn']).strip()] = s

# ── Merge KS4 ──────────────────────────────────
print("\nMerging KS4 data...")
ks4_count = 0
with open(KS4_PATH, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if str(row.get('RECTYPE', '')).strip() != '1':
            continue
        urn = str(row.get('URN', '')).strip()
        if urn not in by_urn:
            continue
        s = by_urn[urn]
        matched = False

        matched = put(s, 'attainment8', row, 'ATT8SCR', 1) or matched
        matched = put(s, 'progress8', row, 'P8MEA', 2) or matched
        matched = put(s, 'basics_94', row, 'PTL2BASICS_94', 0) or matched
        matched = put(s, 'basics_95', row, 'PTL2BASICS_95', 0) or matched
        matched = put(s, 'fsm_pct', row, 'PTFSM6CLA1A', 1) or matched

        put(s, 'a8_disadv', row, 'ATT8SCR_FSM6CLA1A', 1)
        put(s, 'a8_nondisadv', row, 'ATT8SCR_NFSM6CLA1A', 1)
        put(s, 'p8_disadv', row, 'P8MEA_FSM6CLA1A', 2)
        put(s, 'p8_nondisadv', row, 'P8MEA_NFSM6CLA1A', 2)
        put(s, 'b94_disadv', row, 'PTFSM6CLA1ABASICS_94', 0)
        put(s, 'b95_disadv', row, 'PTFSM6CLA1ABASICS_95', 0)
        put(s, 'b94_nondisadv', row, 'PTNOTFSM6CLA1ABASICS_94', 0)
        put(s, 'b95_nondisadv', row, 'PTNOTFSM6CLA1ABASICS_95', 0)

        put(s, 'a8_prev', row, 'ATT8SCR_PREV', 1)
        put(s, 'p8_prev', row, 'P8MEA_PREV', 2)
        put(s, 'b94_prev', row, 'PTL2BASICS_94_PREV', 0)
        put(s, 'b95_prev', row, 'PTL2BASICS_95_PREV', 0)

        if matched:
            ks4_count += 1

print(f"  Matched {ks4_count} schools with KS4 data")

# ── Merge KS2 ──────────────────────────────────
print("\nMerging KS2 data...")
ks2_count = 0
with open(KS2_PATH, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if str(row.get('RECTYPE', '')).strip() != '1':
            continue
        urn = str(row.get('URN', '')).strip()
        if urn not in by_urn:
            continue
        s = by_urn[urn]
        matched = False

        matched = put(s, 'ks2_rwm_exp', row, 'PTRWM_EXP', 0) or matched
        matched = put(s, 'ks2_rwm_high', row, 'PTRWM_HIGH', 0) or matched
        matched = put(s, 'ks2_read_avg', row, 'READ_AVERAGE', 1) or matched
        matched = put(s, 'ks2_read_prog', row, 'READPROG', 2) or matched
        matched = put(s, 'ks2_read_exp', row, 'PTREAD_EXP', 0) or matched
        matched = put(s, 'ks2_mat_exp', row, 'PTMAT_EXP', 0) or matched
        matched = put(s, 'ks2_writ_exp', row, 'PTWRITTA_EXP', 0) or matched
        matched = put(s, 'ks2_gps_exp', row, 'PTGPS_EXP', 0) or matched

        put(s, 'ks2_rwm_disadv', row, 'PTRWM_EXP_FSM6CLA1A', 0)
        put(s, 'ks2_rwm_nondisadv', row, 'PTRWM_EXP_NotFSM6CLA1A', 0)

        put(s, 'ks2_rwm_prev', row, 'PTRWM_EXP_24', 0)
        put(s, 'ks2_read_avg_prev', row, 'READ_AVERAGE_24', 1)

        if matched:
            ks2_count += 1

print(f"  Matched {ks2_count} schools with KS2 data")

# ── Save ───────────────────────────────────────
print(f"\nSaving to {OUTPUT_PATH}...")
with open(OUTPUT_PATH, 'w') as f:
    json.dump(schools, f)

total = len(schools)
a8 = sum(1 for s in schools if 'attainment8' in s)
p8 = sum(1 for s in schools if 'progress8' in s)
fsm = sum(1 for s in schools if 'fsm_pct' in s)
b94 = sum(1 for s in schools if 'basics_94' in s)
ks2 = sum(1 for s in schools if 'ks2_rwm_exp' in s)
rd = sum(1 for s in schools if 'ks2_read_avg' in s)
size_mb = os.path.getsize(OUTPUT_PATH) / 1024 / 1024

print(f"\n{'='*45}")
print(f"  Total schools:     {total:>8,}")
print(f"  With Attainment 8: {a8:>8,}")
print(f"  With Progress 8:   {p8:>8,}")
print(f"  With Basics 4+:    {b94:>8,}")
print(f"  With FSM %:        {fsm:>8,}")
print(f"  With KS2 RWM:      {ks2:>8,}")
print(f"  With KS2 Reading:  {rd:>8,}")
print(f"  File size:         {size_mb:>7.1f} MB")
print(f"{'='*45}")
print("\nDone! Restart dev server: ctrl+c then npm run dev")
