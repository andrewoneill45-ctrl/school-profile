#!/usr/bin/env python3
"""Merge KS4/KS2 data with proper FSM provenance fields."""
import csv, json, os

PROJECT = os.path.expanduser('~/Desktop/school-map-app')
SCHOOLS_PATH = os.path.join(PROJECT, 'public', 'schools.json')
KS4_PATH = os.path.expanduser('~/Desktop/england_ks4revised.csv')
KS2_PATH = os.path.expanduser('~/Desktop/england_ks2revised.csv')
OUTPUT_PATH = SCHOOLS_PATH
SKIP = {'','SUPP','NE','NA','NEW','x','DNS','LOWCOV','SP','N/A','-'}

def safe_float(val):
    if val is None: return None
    val = str(val).strip().replace('%','').replace(',','')
    if val.upper() in SKIP: return None
    try: return float(val)
    except: return None

def put(school, key, row, col, decimals=1):
    v = safe_float(row.get(col))
    if v is not None: school[key] = round(v, decimals); return True
    return False

print("Loading schools.json...")
with open(SCHOOLS_PATH, 'r') as f: schools = json.load(f)
print(f"  Loaded {len(schools)} schools")
by_urn = {str(s.get('urn','')).strip(): s for s in schools}

print("\nMerging KS4 data...")
ks4_count = 0
with open(KS4_PATH, 'r', encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        if str(row.get('RECTYPE','')).strip() != '1': continue
        urn = str(row.get('URN','')).strip()
        if urn not in by_urn: continue
        s = by_urn[urn]; matched = False
        matched = put(s,'attainment8',row,'ATT8SCR',1) or matched
        matched = put(s,'progress8',row,'P8MEA',2) or matched
        matched = put(s,'basics_94',row,'PTL2BASICS_94',0) or matched
        matched = put(s,'basics_95',row,'PTL2BASICS_95',0) or matched
        put(s,'ks4_fsm_pct',row,'PTFSM6CLA1A',1)
        put(s,'ks4_eal_pct',row,'PTEALGRP2',1)
        put(s,'ks4_sen_all_pct',row,'PSEN_ALL4',1)
        put(s,'ks4_sen_ehcp_pct',row,'PSENE4',1)
        put(s,'ks4_sen_k_pct',row,'PSENK4',1)
        put(s,'a8_disadv',row,'ATT8SCR_FSM6CLA1A',1)
        put(s,'a8_nondisadv',row,'ATT8SCR_NFSM6CLA1A',1)
        put(s,'p8_disadv',row,'P8MEA_FSM6CLA1A',2)
        put(s,'p8_nondisadv',row,'P8MEA_NFSM6CLA1A',2)
        put(s,'b94_disadv',row,'PTFSM6CLA1ABASICS_94',0)
        put(s,'b95_disadv',row,'PTFSM6CLA1ABASICS_95',0)
        put(s,'b94_nondisadv',row,'PTNOTFSM6CLA1ABASICS_94',0)
        put(s,'b95_nondisadv',row,'PTNOTFSM6CLA1ABASICS_95',0)
        put(s,'a8_prev',row,'ATT8SCR_PREV',1)
        put(s,'p8_prev',row,'P8MEA_PREV',2)
        put(s,'b94_prev',row,'PTL2BASICS_94_PREV',0)
        put(s,'b95_prev',row,'PTL2BASICS_95_PREV',0)
        if matched: ks4_count += 1
print(f"  Matched {ks4_count} schools with KS4 data")

print("\nMerging KS2 data...")
ks2_count = 0
with open(KS2_PATH, 'r', encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        if str(row.get('RECTYPE','')).strip() != '1': continue
        urn = str(row.get('URN','')).strip()
        if urn not in by_urn: continue
        s = by_urn[urn]; matched = False
        matched = put(s,'ks2_rwm_exp',row,'PTRWM_EXP',0) or matched
        matched = put(s,'ks2_rwm_high',row,'PTRWM_HIGH',0) or matched
        matched = put(s,'ks2_read_avg',row,'READ_AVERAGE',1) or matched
        matched = put(s,'ks2_read_prog',row,'READPROG',2) or matched
        matched = put(s,'ks2_read_exp',row,'PTREAD_EXP',0) or matched
        matched = put(s,'ks2_mat_exp',row,'PTMAT_EXP',0) or matched
        matched = put(s,'ks2_writ_exp',row,'PTWRITTA_EXP',0) or matched
        matched = put(s,'ks2_gps_exp',row,'PTGPS_EXP',0) or matched
        put(s,'ks2_fsm_pct',row,'PTFSM6CLA1A',1)
        put(s,'ks2_eal_pct',row,'PTEALGRP2',1)
        put(s,'ks2_sen_all_pct',row,'PSENELEK',1)
        put(s,'ks2_sen_ehcp_pct',row,'PSENELE',1)
        put(s,'ks2_sen_k_pct',row,'PSENELK',1)
        put(s,'ks2_rwm_disadv',row,'PTRWM_EXP_FSM6CLA1A',0)
        put(s,'ks2_rwm_nondisadv',row,'PTRWM_EXP_NotFSM6CLA1A',0)
        put(s,'ks2_rwm_prev',row,'PTRWM_EXP_24',0)
        put(s,'ks2_read_avg_prev',row,'READ_AVERAGE_24',1)
        if matched: ks2_count += 1
print(f"  Matched {ks2_count} schools with KS2 data")

print("\nBuilding fsm_pct convenience alias...")
fsm_edu, fsm_ks4, fsm_ks2 = 0, 0, 0
for s in schools:
    if 'edu_fsm_pct' in s: s['fsm_pct'] = s['edu_fsm_pct']; fsm_edu+=1
    elif 'ks4_fsm_pct' in s: s['fsm_pct'] = s['ks4_fsm_pct']; fsm_ks4+=1
    elif 'ks2_fsm_pct' in s: s['fsm_pct'] = s['ks2_fsm_pct']; fsm_ks2+=1
print(f"  from Edubase: {fsm_edu:>6,}  from KS4: {fsm_ks4:>6,}  from KS2: {fsm_ks2:>6,}")

print(f"\nSaving to {OUTPUT_PATH}...")
with open(OUTPUT_PATH, 'w') as f: json.dump(schools, f)
total = len(schools)
size_mb = os.path.getsize(OUTPUT_PATH)/1024/1024
print(f"\n{'='*50}")
print(f"  Total schools:         {total:>8,}")
print(f"  With Attainment 8:     {sum(1 for s in schools if 'attainment8' in s):>8,}")
print(f"  With Progress 8:       {sum(1 for s in schools if 'progress8' in s):>8,}")
print(f"  With KS2 RWM:          {sum(1 for s in schools if 'ks2_rwm_exp' in s):>8,}")
print(f"  --- FSM Provenance ---")
print(f"  edu_fsm_pct (Edubase): {sum(1 for s in schools if 'edu_fsm_pct' in s):>8,}")
print(f"  ks4_fsm_pct (cohort):  {sum(1 for s in schools if 'ks4_fsm_pct' in s):>8,}")
print(f"  ks2_fsm_pct (cohort):  {sum(1 for s in schools if 'ks2_fsm_pct' in s):>8,}")
print(f"  fsm_pct (alias):       {sum(1 for s in schools if 'fsm_pct' in s):>8,}")
print(f"  File size:             {size_mb:>7.1f} MB")
print(f"{'='*50}")
print("\nDone! Run: npm run dev")
