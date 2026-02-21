#!/usr/bin/env python3
"""
Slim schools.json for faster mobile loading.
- Removes null/None values
- Rounds numbers to reduce decimal places
- Reports size before/after
"""
import json, os

PATH = os.path.expanduser('~/school-profile/src/schools.json')

print("Loading...")
with open(PATH) as f:
    schools = json.load(f)
print(f"  {len(schools)} schools")

before = os.path.getsize(PATH)
print(f"  Before: {before / 1024 / 1024:.1f} MB")

# Clean each school
for s in schools:
    # Remove keys with None/null values
    remove = [k for k, v in s.items() if v is None or v == '' or v == 'None']
    for k in remove:
        del s[k]
    
    # Round floats to save bytes
    for k, v in s.items():
        if isinstance(v, float):
            if k in ('latitude', 'longitude'):
                s[k] = round(v, 4)  # 4dp ≈ 11m precision, fine for mapping
            elif 'pct' in k or k in ('fsm_pct', 'stability_pct'):
                s[k] = round(v, 1)
            elif k in ('attainment8', 'p8_prev', 'progress8'):
                s[k] = round(v, 2)
            else:
                s[k] = round(v, 1)
    
    # Slim trend arrays - remove None values within trend entries
    for trend_key in ('ks4_trend', 'ks2_trend'):
        if trend_key in s:
            slimmed = []
            for entry in s[trend_key]:
                clean = {k: v for k, v in entry.items() if v is not None}
                if len(clean) > 1:  # more than just 'year'
                    slimmed.append(clean)
            if len(slimmed) >= 2:
                s[trend_key] = slimmed
            else:
                del s[trend_key]

# Save with compact separators (no extra whitespace)
print("Saving...")
with open(PATH, 'w') as f:
    json.dump(schools, f, separators=(',', ':'))

after = os.path.getsize(PATH)
print(f"  After: {after / 1024 / 1024:.1f} MB")
print(f"  Saved: {(before - after) / 1024 / 1024:.1f} MB ({(before - after) * 100 // before}%)")

# Check a sample
for s in schools:
    if s.get('ks4_trend') and s.get('sen_ehcp_pct'):
        print(f"\n  Sample: {s['name']}")
        print(f"    Keys: {len(s)}")
        print(f"    Size: ~{len(json.dumps(s, separators=(',',':')))} bytes")
        break

print("\nDone!")
