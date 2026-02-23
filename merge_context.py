#!/usr/bin/env python3
"""
Merge contextual data (SEN, EAL, prior attainment, mobility) into schools.json
for the Similar Schools feature. Run AFTER merge_performance.py and merge_historic.py.

Run: python3 merge_context.py
"""
import csv, json, os

SCHOOLS = os.path.expanduser('~/school-profile/src/schools.json')
KS4 = os.path.expanduser('~/Desktop/england_ks4revised.csv')
KS2 = os.path.expanduser('~/Desktop/england_ks2revised.csv')

SKIP = {'', 'SUPP', 'NE', 'NA', 'NEW', 'x', 'DNS', 'LOWCOV', 'SP', 'N/A', '-'}

def sf(val):
    if val is None: return None
    val = str(val).strip().replace('%', '').replace(',', '')
    if val.upper() in SKIP: return None
    try: return round(float(val), 1)
    except: return None

print("Loading schools.json...")
with open(SCHOOLS) as f:
    schools = json.load(f)
by_urn = {str(s['urn']).strip(): s for s in schools}
print(f"  {len(schools)} schools")

# ── KS4 contextual data ───────────────────────
print("\nReading KS4 context...")
ks4_count = 0
with open(KS4, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    # Print available SEN/EAL columns for verification
    sen_cols = [h for h in reader.fieldnames if any(x in h.upper() for x in ['SEN', 'EAL', 'PRIOR', 'NMOB'])]
    print(f"  Found context columns: {len(sen_cols)}")
    
for row_num in range(2):  # Two passes - first to check, second to merge
    with open(KS4, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if row_num == 0:
            # Just check one row for column verification
            for row in reader:
                if str(row.get('RECTYPE','')).strip() != '1': continue
                print(f"\n  Sample KS4 contextual values:")
                for col in ['SENE4', 'PSENE4', 'SENK4', 'PSENK4', 'SEN_ALL4', 'PSEN_ALL4',
                           'TEALGRP2', 'PTEALGRP2', 'TPRIORLO', 'PTPRIORLO', 
                           'TPRIORAV', 'PTPRIORAV', 'TPRIORHI', 'PTPRIORHI',
                           'TNMOB', 'PTNMOB', 'TFSM6CLA1A', 'PTFSM6CLA1A']:
                    print(f"    {col}: {row.get(col, 'MISSING')}")
                break
            continue
        
        for row in reader:
            if str(row.get('RECTYPE','')).strip() != '1': continue
            urn = str(row.get('URN','')).strip()
            if urn not in by_urn: continue
            s = by_urn[urn]
            
            # SEN with EHCP (%)
            v = sf(row.get('PSENE4'))
            if v is not None: s['sen_ehcp_pct'] = v
            
            # SEN Support / SEN K (%)
            v = sf(row.get('PSENK4'))
            if v is not None: s['sen_k_pct'] = v
            
            # All SEN (%)
            v = sf(row.get('PSEN_ALL4'))
            if v is not None: s['sen_all_pct'] = v
            
            # EAL (%)
            v = sf(row.get('PTEALGRP2'))
            if v is not None: s['eal_pct'] = v
            
            # Prior attainment bands (%)
            v = sf(row.get('PTPRIORLO'))
            if v is not None: s['prior_lo_pct'] = v
            v = sf(row.get('PTPRIORAV'))
            if v is not None: s['prior_av_pct'] = v
            v = sf(row.get('PTPRIORHI'))
            if v is not None: s['prior_hi_pct'] = v
            
            # Mobility (%)
            v = sf(row.get('PTNMOB'))
            if v is not None: s['stability_pct'] = v  # % non-mobile = stability
            
            ks4_count += 1

print(f"  Merged context for {ks4_count} KS4 schools")

# ── KS2 contextual data ───────────────────────
print("\nReading KS2 context...")
ks2_count = 0
with open(KS2, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    sen_cols2 = [h for h in reader.fieldnames if any(x in h.upper() for x in ['SEN', 'EAL', 'KS1', 'NMOB', 'MOB'])]
    print(f"  Found context columns: {len(sen_cols2)}")

for row_num in range(2):
    with open(KS2, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if row_num == 0:
            for row in reader:
                if str(row.get('RECTYPE','')).strip() != '1': continue
                print(f"\n  Sample KS2 contextual values:")
                for col in ['TSENELE', 'PSENELE', 'TSENELK', 'PSENELK', 'TSENELEK', 'PSENELEK',
                           'TEALGRP2', 'PTEALGRP2', 'TKS1GROUP_L', 'PTKS1GROUP_L',
                           'TKS1GROUP_M', 'PTKS1GROUP_M', 'TKS1GROUP_H', 'PTKS1GROUP_H',
                           'TMOBN', 'PTMOBN', 'TFSM6CLA1A', 'PTFSM6CLA1A']:
                    print(f"    {col}: {row.get(col, 'MISSING')}")
                break
            continue
        
        for row in reader:
            if str(row.get('RECTYPE','')).strip() != '1': continue
            urn = str(row.get('URN','')).strip()
            if urn not in by_urn: continue
            s = by_urn[urn]
            
            # SEN EHCP (%)
            v = sf(row.get('PSENELE'))
            if v is not None: s['sen_ehcp_pct'] = v
            
            # SEN K (%)
            v = sf(row.get('PSENELK'))
            if v is not None: s['sen_k_pct'] = v
            
            # All SEN (%)
            v = sf(row.get('PSENELEK'))
            if v is not None: s['sen_all_pct'] = v
            
            # EAL (%)
            v = sf(row.get('PTEALGRP2'))
            if v is not None: s['eal_pct'] = v
            
            # KS1 prior attainment bands (%) 
            v = sf(row.get('PTKS1GROUP_L'))
            if v is not None: s['prior_lo_pct'] = v
            v = sf(row.get('PTKS1GROUP_M'))
            if v is not None: s['prior_av_pct'] = v
            v = sf(row.get('PTKS1GROUP_H'))
            if v is not None: s['prior_hi_pct'] = v
            
            # Mobility (% mobile - note KS2 uses PTMOBN differently)
            v = sf(row.get('PTMOBN'))
            if v is not None: s['stability_pct'] = v
            
            ks2_count += 1

print(f"  Merged context for {ks2_count} KS2 schools")

# ── Summary ────────────────────────────────────
print("\n=== Coverage Check ===")
for field in ['sen_ehcp_pct', 'sen_k_pct', 'sen_all_pct', 'eal_pct', 
              'prior_lo_pct', 'prior_av_pct', 'prior_hi_pct', 'stability_pct']:
    count = sum(1 for s in schools if s.get(field) is not None)
    print(f"  {field}: {count:,} schools ({count*100//len(schools)}%)")

# Save
print(f"\nSaving...")
with open(SCHOOLS, 'w') as f:
    json.dump(schools, f)

size_mb = os.path.getsize(SCHOOLS) / 1024 / 1024
print(f"  File size: {size_mb:.1f} MB")

# Sample
for s in schools:
    if s.get('sen_ehcp_pct') is not None and s.get('eal_pct') is not None and s.get('phase') == 'Secondary':
        print(f"\n  Sample: {s['name']}")
        print(f"    FSM: {s.get('fsm_pct')}%, SEN EHCP: {s.get('sen_ehcp_pct')}%, SEN K: {s.get('sen_k_pct')}%")
        print(f"    EAL: {s.get('eal_pct')}%, Prior Lo: {s.get('prior_lo_pct')}%, Prior Hi: {s.get('prior_hi_pct')}%")
        print(f"    Stability: {s.get('stability_pct')}%")
        break

for s in schools:
    if s.get('sen_ehcp_pct') is not None and s.get('eal_pct') is not None and s.get('phase') == 'Primary':
        print(f"\n  Sample: {s['name']}")
        print(f"    FSM: {s.get('fsm_pct')}%, SEN EHCP: {s.get('sen_ehcp_pct')}%, SEN K: {s.get('sen_k_pct')}%")
        print(f"    EAL: {s.get('eal_pct')}%, Prior Lo: {s.get('prior_lo_pct')}%, Prior Hi: {s.get('prior_hi_pct')}%")
        print(f"    Stability: {s.get('stability_pct')}%")
        break

print("\nDone!")
