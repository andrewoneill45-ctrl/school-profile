#!/usr/bin/env python3
"""Process GIAS/Edubase data — outputs edu_fsm_pct (whole-school FSM)"""
import csv, json, math, os, glob

PROJECT = os.path.expanduser('~/Desktop/school-map-app')
INPUT_PATTERN = os.path.expanduser('~/Desktop/edubasealldata*.csv')
OUTPUT_PATH = os.path.join(PROJECT, 'public', 'schools.json')

matches = glob.glob(INPUT_PATTERN)
if not matches: print(f"ERROR: No file matching {INPUT_PATTERN}"); exit(1)
INPUT_PATH = sorted(matches)[-1]
print(f"Using: {INPUT_PATH}")

def bng_to_latlon(easting, northing):
    a, b = 6377563.396, 6356256.909
    F0 = 0.9996012717
    lat0, lon0 = math.radians(49.0), math.radians(-2.0)
    N0, E0 = -100000.0, 400000.0
    e2 = 1-(b*b)/(a*a); n = (a-b)/(a+b)
    lat, M = lat0, 0
    while True:
        lat = ((northing-N0-M)/(a*F0))+lat
        Ma = (1+n+(5/4)*n**2+(5/4)*n**3)*(lat-lat0)
        Mb = (3*n+3*n**2+(21/8)*n**3)*math.sin(lat-lat0)*math.cos(lat+lat0)
        Mc = ((15/8)*n**2+(15/8)*n**3)*math.sin(2*(lat-lat0))*math.cos(2*(lat+lat0))
        Md = (35/24)*n**3*math.sin(3*(lat-lat0))*math.cos(3*(lat+lat0))
        M = b*F0*(Ma-Mb+Mc-Md)
        if abs(northing-N0-M)<0.00001: break
    cos_lat, sin_lat = math.cos(lat), math.sin(lat)
    nu = a*F0/math.sqrt(1-e2*sin_lat**2)
    rho = a*F0*(1-e2)/((1-e2*sin_lat**2)**1.5)
    eta2 = nu/rho-1; tan_lat = math.tan(lat)
    VII = tan_lat/(2*rho*nu)
    VIII = tan_lat/(24*rho*nu**3)*(5+3*tan_lat**2+eta2-9*tan_lat**2*eta2)
    IX = tan_lat/(720*rho*nu**5)*(61+90*tan_lat**2+45*tan_lat**4)
    X = 1/(cos_lat*nu)
    XI = 1/(cos_lat*6*nu**3)*(nu/rho+2*tan_lat**2)
    XII = 1/(cos_lat*120*nu**5)*(5+28*tan_lat**2+24*tan_lat**4)
    dE = easting-E0
    return math.degrees(lat-VII*dE**2+VIII*dE**4-IX*dE**6), math.degrees(lon0+X*dE-XI*dE**3+XII*dE**5)

def safe_float(val):
    if val is None: return None
    val = str(val).strip().replace('%','').replace(',','')
    if val=='' or val.upper() in ('','NA','N/A','-'): return None
    try: return float(val)
    except: return None

def safe_int(val):
    f = safe_float(val); return int(f) if f is not None else None

def safe_str(val):
    if val is None: return None
    val = str(val).strip()
    if val=='' or val.lower() in ('not applicable','not recorded','none','null'): return None
    return val

def find_col(row, candidates):
    for c in candidates:
        if c in row and row[c]: return c
    return None

encodings = ['utf-8-sig','utf-8','latin-1','cp1252']
reader, f = None, None
for enc in encodings:
    try:
        f = open(INPUT_PATH,'r',encoding=enc); reader = csv.DictReader(f)
        next(reader); f.seek(0); reader = csv.DictReader(f)
        print(f"  Encoding: {enc}"); break
    except:
        if f: f.close()
if not reader: print("ERROR: Could not read CSV"); exit(1)

schools, skipped, converted = [], 0, 0
for row in reader:
    urn = safe_str(row.get('URN'))
    if not urn: skipped+=1; continue
    status_col = find_col(row, ['EstablishmentStatus (name)','EstablishmentStatus','Status'])
    status = row.get(status_col,'') if status_col else ''
    if 'closed' in status.lower(): skipped+=1; continue
    name_col = find_col(row, ['EstablishmentName','Name'])
    name = safe_str(row.get(name_col)) if name_col else None
    if not name: skipped+=1; continue
    phase_col = find_col(row, ['PhaseOfEducation (name)','PhaseOfEducation'])
    phase = safe_str(row.get(phase_col)) if phase_col else None
    type_col = find_col(row, ['TypeOfEstablishment (name)','TypeOfEstablishment'])
    school_type = safe_str(row.get(type_col)) if type_col else None
    easting = safe_float(row.get('Easting')); northing = safe_float(row.get('Northing'))
    lat = safe_float(row.get('Latitude')); lon = safe_float(row.get('Longitude'))
    if easting and northing and easting>10000: lat, lon = bng_to_latlon(easting, northing); converted+=1
    elif lat and lon and abs(lat)>100: lat, lon = bng_to_latlon(lon, lat); converted+=1
    if not lat or not lon: skipped+=1; continue
    school = {'urn':urn,'name':name,'type':school_type,'phase':phase,
        'latitude':round(lat,6),'longitude':round(lon,6),
        'postcode':safe_str(row.get('Postcode')),'pupils':safe_int(row.get('NumberOfPupils')),
        'capacity':safe_int(row.get('SchoolCapacity')),
        'la':safe_str(row.get('LA (name)')) or safe_str(row.get('LA')),
        'town':safe_str(row.get('Town')),
        'region':safe_str(row.get('GOR (name)')) or safe_str(row.get('GOR')),
        'religiousCharacter':safe_str(row.get('ReligiousCharacter (name)')) or safe_str(row.get('ReligiousCharacter')),
        'gender':safe_str(row.get('Gender (name)')) or safe_str(row.get('Gender')),
        'trust':safe_str(row.get('Trusts (name)')) or safe_str(row.get('TrustSchoolFlag (name)'))}
    edu_fsm = safe_float(row.get('PercentageFSM'))
    if edu_fsm is not None: school['edu_fsm_pct'] = round(edu_fsm,1)
    age_low = safe_int(row.get('StatutoryLowAge')); age_high = safe_int(row.get('StatutoryHighAge'))
    if age_low is not None: school['age_low'] = age_low
    if age_high is not None: school['age_high'] = age_high
    sixth = safe_str(row.get('OfficialSixthForm (name)')) or safe_str(row.get('OfficialSixthForm'))
    if sixth: school['sixth_form'] = sixth
    ofsted_col = find_col(row, ['OfstedRating (name)','OfstedRating'])
    ofsted = safe_str(row.get(ofsted_col)) if ofsted_col else None
    school['ofsted'] = ofsted or 'Not inspected'
    head_parts = [safe_str(row.get('HeadTitle (name)')) or safe_str(row.get('HeadTitle')),
                  safe_str(row.get('HeadFirstName')), safe_str(row.get('HeadLastName'))]
    head = ' '.join([p for p in head_parts if p])
    if head.strip(): school['headteacher'] = head.strip()
    website = safe_str(row.get('SchoolWebsite'))
    if website: school['website'] = website
    sen_ehcp = safe_float(row.get('SENStat')); sen_k = safe_float(row.get('SENNoStat'))
    if sen_ehcp is not None: school['sen_ehcp_pct'] = round(sen_ehcp,1)
    if sen_k is not None: school['sen_k_pct'] = round(sen_k,1)
    if sen_ehcp is not None and sen_k is not None: school['sen_all_pct'] = round(sen_ehcp+sen_k,1)
    eal = safe_float(row.get('PercentageEAL'))
    if eal is not None: school['eal_pct'] = round(eal,1)
    stability = safe_float(row.get('PercentageOfPupilsStable'))
    if stability is not None: school['stability_pct'] = round(stability,1)
    school = {k:v for k,v in school.items() if v is not None}
    schools.append(school)
f.close()
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
print(f"\nSaving {len(schools)} schools to {OUTPUT_PATH}...")
with open(OUTPUT_PATH, 'w') as out: json.dump(schools, out)
has_fsm = sum(1 for s in schools if 'edu_fsm_pct' in s)
has_sen = sum(1 for s in schools if 'sen_all_pct' in s)
has_eal = sum(1 for s in schools if 'eal_pct' in s)
size_mb = os.path.getsize(OUTPUT_PATH)/1024/1024
print(f"\n{'='*50}")
print(f"  Total open schools:    {len(schools):>8,}")
print(f"  With edu_fsm_pct:     {has_fsm:>8,}")
print(f"  With SEN:             {has_sen:>8,}")
print(f"  With EAL:             {has_eal:>8,}")
print(f"  File size:            {size_mb:>7.1f} MB")
print(f"{'='*50}")
print("\nNext: python3 merge_performance_v2.py")
