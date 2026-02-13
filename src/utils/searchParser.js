/**
 * Smart Search Parser — Natural language query understanding
 * 
 * Handles queries like:
 *   "show me outstanding secondary schools in darlington"
 *   "best performing primaries in north east"
 *   "schools near W10 with good attainment"
 *   "catholic schools in london"
 *   "large academies in yorkshire"
 *   "ark schools"
 *   "harris federation"
 *   "high performing schools with more than 1000 pupils"
 *   "struggling schools in manchester"
 *   "church of england primaries"
 */

// ─── Reference data ──────────────────────────────────────────

const REGIONS = [
  'london', 'south east', 'south west', 'east of england', 'east midlands',
  'west midlands', 'yorkshire and the humber', 'yorkshire', 'north west', 'north east'
];

const REGION_ALIASES = {
  'the north': 'North East',
  'north': 'North East',
  'the south': 'South East',
  'the midlands': 'West Midlands',
  'east anglia': 'East of England',
  'the west country': 'South West',
};

const PHASE_KEYWORDS = {
  'primary': 'Primary', 'primaries': 'Primary', 'primary school': 'Primary',
  'junior': 'Primary', 'infant': 'Primary', 'juniors': 'Primary',
  'secondary': 'Secondary', 'secondaries': 'Secondary', 'secondary school': 'Secondary',
  'high school': 'Secondary', 'high schools': 'Secondary',
  'special': 'Special', 'special school': 'Special', 'sen school': 'Special',
  'nursery': 'Nursery', 'nurseries': 'Nursery',
  'all-through': 'All-through', 'all through': 'All-through',
  'sixth form': '16 plus', 'post-16': '16 plus', 'post 16': '16 plus',
  'college': '16 plus',
};

const OFSTED_KEYWORDS = {
  'outstanding': 'Outstanding', 'ofsted 1': 'Outstanding',
  'good': 'Good', 'ofsted 2': 'Good',
  'requires improvement': 'Requires improvement', 'ri': 'Requires improvement',
  'requires improving': 'Requires improvement',
  'inadequate': 'Inadequate', 'ofsted 4': 'Inadequate', 'failing': 'Inadequate',
};

const TYPE_KEYWORDS = {
  'academy': 'academy', 'academies': 'academy',
  'free school': 'free school', 'free schools': 'free school',
  'maintained': 'maintained', 'community school': 'community',
  'voluntary aided': 'voluntary aided', 'va school': 'voluntary aided',
  'voluntary controlled': 'voluntary controlled', 'vc school': 'voluntary controlled',
  'grammar': 'grammar', 'grammars': 'grammar',
  'independent': 'independent', 'private': 'independent',
};

const FAITH_KEYWORDS = {
  'catholic': 'Roman Catholic', 'rc': 'Roman Catholic',
  'church of england': 'Church of England', 'c of e': 'Church of England',
  'coe': 'Church of England', 'ce': 'Church of England', 'anglican': 'Church of England',
  'jewish': 'Jewish', 'muslim': 'Muslim', 'islamic': 'Muslim',
  'sikh': 'Sikh', 'hindu': 'Hindu', 'methodist': 'Methodist',
  'faith school': 'faith', 'religious': 'faith',
};

const PERFORMANCE_SYNONYMS = {
  'best performing': { minAttainment8: 55 },
  'best': { minAttainment8: 55 },
  'top performing': { minAttainment8: 60 },
  'top': { minAttainment8: 60 },
  'high performing': { minAttainment8: 50 },
  'high attaining': { minAttainment8: 50 },
  'well above average': { minAttainment8: 55 },
  'above average': { minAttainment8: 48 },
  'below average': { maxAttainment8: 42 },
  'struggling': { maxAttainment8: 35 },
  'underperforming': { maxAttainment8: 38 },
  'low performing': { maxAttainment8: 38 },
  'poorly performing': { maxAttainment8: 35 },
  'coasting': { minAttainment8: 38, maxAttainment8: 46 },
};

const SIZE_SYNONYMS = {
  'large': { minPupils: 1000 },
  'very large': { minPupils: 1500 },
  'big': { minPupils: 1000 },
  'small': { maxPupils: 300 },
  'very small': { maxPupils: 150 },
  'tiny': { maxPupils: 100 },
};

// ─── Fuzzy matching helper ───────────────────────────────────

function fuzzyMatch(input, target) {
  const a = input.toLowerCase();
  const b = target.toLowerCase();
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.9;
  
  // Levenshtein-based similarity for short strings
  if (a.length < 3 || b.length < 3) return 0;
  
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  
  if (longer.length === 0) return 1;
  
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  
  return matches / longer.length;
}

// ─── Main parser ─────────────────────────────────────────────

export function parseSearchQuery(query, schoolsData) {
  if (!query || !query.trim()) return null;

  const original = query.trim();
  const lower = original.toLowerCase();
  const filters = {};

  // Strip common filler words for cleaner parsing
  const stripped = lower
    .replace(/^(show me|find|search for|list|display|get|what are|where are)\s+/i, '')
    .replace(/\b(all|the|all the|every|any|some)\b/g, '')
    .replace(/\bschools?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // ─── Phase detection ───────────────────────────
  for (const [keyword, value] of Object.entries(PHASE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      filters.phase = value;
      break;
    }
  }

  // ─── Ofsted detection ──────────────────────────
  for (const [keyword, value] of Object.entries(OFSTED_KEYWORDS)) {
    if (lower.includes(keyword)) {
      filters.ofsted = value;
      break;
    }
  }

  // ─── Performance synonyms ──────────────────────
  for (const [keyword, perfFilters] of Object.entries(PERFORMANCE_SYNONYMS)) {
    if (lower.includes(keyword)) {
      Object.assign(filters, perfFilters);
      break;
    }
  }

  // ─── Size synonyms ────────────────────────────
  for (const [keyword, sizeFilters] of Object.entries(SIZE_SYNONYMS)) {
    if (lower.includes(keyword) && (lower.includes(keyword + ' school') || lower.includes(keyword + ' primary') || lower.includes(keyword + ' secondary') || lower.includes(keyword + ' academ') || stripped.includes(keyword))) {
      Object.assign(filters, sizeFilters);
      break;
    }
  }

  // ─── School type detection ─────────────────────
  for (const [keyword, value] of Object.entries(TYPE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      filters.typeQuery = value;
      break;
    }
  }

  // ─── Faith detection ───────────────────────────
  for (const [keyword, value] of Object.entries(FAITH_KEYWORDS)) {
    if (lower.includes(keyword)) {
      filters.faithQuery = value;
      break;
    }
  }

  // ─── Gender detection ──────────────────────────
  if (lower.includes('girls') || lower.includes("girl's") || lower.includes('all-girls') || lower.includes('all girls')) {
    filters.gender = 'Girls';
  } else if (lower.includes('boys') || lower.includes("boy's") || lower.includes('all-boys') || lower.includes('all boys')) {
    filters.gender = 'Boys';
  } else if (lower.includes('mixed') || lower.includes('co-ed') || lower.includes('coed')) {
    filters.gender = 'Mixed';
  }

  // ─── Region detection ──────────────────────────
  for (const region of REGIONS) {
    if (lower.includes(region)) {
      filters.region = region;
      break;
    }
  }
  if (!filters.region) {
    for (const [alias, region] of Object.entries(REGION_ALIASES)) {
      if (lower.includes(alias)) {
        filters.region = region.toLowerCase();
        break;
      }
    }
  }

  // ─── Numeric metric extraction ─────────────────
  
  // Attainment 8
  const a8Above = lower.match(/attainment\s*8?\s*(?:above|over|greater than|>|more than|higher than|at least)\s*([\d.]+)/);
  const a8Below = lower.match(/attainment\s*8?\s*(?:below|under|less than|<|lower than)\s*([\d.]+)/);
  const a8Between = lower.match(/attainment\s*8?\s*between\s*([\d.]+)\s*(?:and|to|-)\s*([\d.]+)/);
  if (a8Above) filters.minAttainment8 = parseFloat(a8Above[1]);
  if (a8Below) filters.maxAttainment8 = parseFloat(a8Below[1]);
  if (a8Between) { filters.minAttainment8 = parseFloat(a8Between[1]); filters.maxAttainment8 = parseFloat(a8Between[2]); }

  // Progress 8
  const p8Above = lower.match(/progress\s*8?\s*(?:above|over|greater than|>|more than|higher than|at least)\s*([-\d.]+)/);
  const p8Below = lower.match(/progress\s*8?\s*(?:below|under|less than|<|lower than)\s*([-\d.]+)/);
  if (p8Above) filters.minProgress8 = parseFloat(p8Above[1]);
  if (p8Below) filters.maxProgress8 = parseFloat(p8Below[1]);

  // Positive/negative P8
  if (lower.includes('positive progress 8') || lower.includes('positive p8')) filters.minProgress8 = 0.01;
  if (lower.includes('negative progress 8') || lower.includes('negative p8')) filters.maxProgress8 = -0.01;

  // Pupil numbers
  const pupilsAbove = lower.match(/(?:more than|above|over|>|at least|bigger than)\s*(\d+)\s*(?:pupils?|students?|children|kids)/);
  const pupilsBelow = lower.match(/(?:less than|fewer than|below|under|<|smaller than)\s*(\d+)\s*(?:pupils?|students?|children|kids)/);
  if (pupilsAbove) filters.minPupils = parseInt(pupilsAbove[1]);
  if (pupilsBelow) filters.maxPupils = parseInt(pupilsBelow[1]);

  // Basics
  const basics4 = lower.match(/(?:4\+|basics\s*4|english and maths 4|eng.{0,5}maths 4)\s*(?:above|over|>)\s*(\d+)/);
  const basics5 = lower.match(/(?:5\+|basics\s*5|english and maths 5|eng.{0,5}maths 5)\s*(?:above|over|>)\s*(\d+)/);
  if (basics4) filters.minBasics4 = parseFloat(basics4[1]);
  if (basics5) filters.minBasics5 = parseFloat(basics5[1]);

  // FSM
  const fsmAbove = lower.match(/(?:fsm|free school meals?|disadvantaged|pupil premium)\s*(?:above|over|>|more than)\s*(\d+)/);
  if (fsmAbove) filters.minFSM = parseFloat(fsmAbove[1]);

  // ─── Postcode detection ────────────────────────
  const postcodeMatch = original.match(/\b([A-Za-z]{1,2}\d{1,2}[A-Za-z]?\s*\d?[A-Za-z]{0,2})\b/);
  if (postcodeMatch) {
    const pc = postcodeMatch[1].toUpperCase().trim();
    if (/^[A-Z]{1,2}\d/.test(pc) && pc.length >= 2 && pc.length <= 8) {
      filters.postcodeQuery = pc;
    }
  }

  // ─── Location / LA / Town detection ────────────
  // Match "in <place>", "near <place>", "around <place>", or just bare place names
  const locationPatterns = [
    /(?:in|near|around|from|across)\s+([a-z][a-z\s]{1,30}?)(?:\s+(?:with|that|where|and|region|la|who|which|having|show)|$)/i,
  ];

  if (!filters.region && !filters.postcodeQuery) {
    for (const pattern of locationPatterns) {
      const match = lower.match(pattern);
      if (match) {
        let place = match[1].trim();
        // Strip trailing filler words
        place = place.replace(/\s+(school|schools|primary|secondary|special|academy|academies|that|are|is|with|above|below|more|less|good|outstanding|inadequate).*$/, '').trim();
        const nonPlaces = ['england', 'the uk', 'uk', 'the country', 'my area', 'the map', 'a', 'this area'];
        if (!nonPlaces.includes(place) && place.length > 1) {
          filters.locationQuery = place;
          break;
        }
      }
    }
  }

  // ─── Trust / MAT detection ─────────────────────
  // Match known trust patterns
  const trustPatterns = [
    /(?:trust|mat|academy trust|multi.academy)\s+(?:called|named)?\s*['"]?([a-z\s]+?)['"]?(?:\s|$)/i,
    /(ark|harris|oasis|dixons|united learning|delta|outwood|inspiration|reach|education|ormiston)\s*(?:federation|trust|schools|academies)?/i,
  ];
  for (const pattern of trustPatterns) {
    const match = lower.match(pattern);
    if (match && !filters.trustQuery) {
      filters.trustQuery = match[1].trim();
      break;
    }
  }

  // ─── Direct school name search ─────────────────
  const nameMatch = lower.match(/(?:called|named)\s+['"]?([a-z\s]+?)['"]?(?:\s|$)/i);
  if (nameMatch) filters.nameQuery = nameMatch[1].trim();

  // ─── Fallback: if no filters matched, treat entire query as fuzzy name/location search ───
  if (Object.keys(filters).length === 0 && original.length >= 2) {
    filters.fuzzyQuery = original;
  }

  return Object.keys(filters).length > 0 ? filters : null;
}

// ─── Apply filters ───────────────────────────────────────────

export function applyFilters(schools, filters) {
  if (!filters) return schools;

  let results = schools.filter(school => {
    if (filters.phase && school.phase !== filters.phase) return false;
    if (filters.ofsted && school.ofsted !== filters.ofsted) return false;
    if (filters.gender && school.gender !== filters.gender) return false;

    if (filters.region) {
      const schoolRegion = (school.region || '').toLowerCase();
      if (!schoolRegion.includes(filters.region)) return false;
    }

    if (filters.locationQuery) {
      const q = filters.locationQuery.toLowerCase();
      const la = (school.la || '').toLowerCase();
      const town = (school.town || '').toLowerCase();
      const name = (school.name || '').toLowerCase();
      const postcode = (school.postcode || '').toLowerCase();
      if (!la.includes(q) && !town.includes(q) && !name.includes(q) && !postcode.startsWith(q)) return false;
    }

    if (filters.nameQuery) {
      const q = filters.nameQuery.toLowerCase();
      if (!(school.name || '').toLowerCase().includes(q)) return false;
    }

    if (filters.postcodeQuery) {
      const pc = (school.postcode || '').toUpperCase().replace(/\s/g, '');
      const query = filters.postcodeQuery.replace(/\s/g, '');
      if (!pc.startsWith(query)) return false;
    }

    if (filters.trustQuery) {
      const q = filters.trustQuery.toLowerCase();
      const trust = (school.trust || '').toLowerCase();
      const name = (school.name || '').toLowerCase();
      if (!trust.includes(q) && !name.includes(q)) return false;
    }

    if (filters.typeQuery) {
      const type = (school.type || '').toLowerCase();
      if (!type.includes(filters.typeQuery)) return false;
    }

    if (filters.faithQuery) {
      const faith = (school.religiousCharacter || '').toLowerCase();
      if (filters.faithQuery === 'faith') {
        if (!faith || faith === 'none' || faith === 'does not apply') return false;
      } else {
        if (!faith.includes(filters.faithQuery.toLowerCase())) return false;
      }
    }

    if (filters.minAttainment8 != null && (school.attainment8 == null || school.attainment8 < filters.minAttainment8)) return false;
    if (filters.maxAttainment8 != null && (school.attainment8 == null || school.attainment8 > filters.maxAttainment8)) return false;
    if (filters.minProgress8 != null && (school.progress8 == null || school.progress8 < filters.minProgress8)) return false;
    if (filters.maxProgress8 != null && (school.progress8 == null || school.progress8 > filters.maxProgress8)) return false;
    if (filters.minPupils != null && (school.pupils == null || school.pupils < filters.minPupils)) return false;
    if (filters.maxPupils != null && (school.pupils == null || school.pupils > filters.maxPupils)) return false;
    if (filters.minBasics4 != null && (school.basics_94 == null || school.basics_94 < filters.minBasics4)) return false;
    if (filters.minBasics5 != null && (school.basics_95 == null || school.basics_95 < filters.minBasics5)) return false;
    if (filters.minFSM != null && (school.fsm_pct == null || school.fsm_pct < filters.minFSM)) return false;

    // Fuzzy query — matches against name, town, LA, trust, postcode
    if (filters.fuzzyQuery) {
      const q = filters.fuzzyQuery.toLowerCase();
      const targets = [
        school.name, school.la, school.town, school.trust,
        school.postcode, school.region, school.type, school.religiousCharacter
      ].filter(Boolean).map(t => t.toLowerCase());

      const directMatch = targets.some(t => t.includes(q) || q.includes(t));
      if (!directMatch) {
        // Try word-level matching
        const queryWords = q.split(/\s+/);
        const allText = targets.join(' ');
        const wordMatch = queryWords.every(w => allText.includes(w));
        if (!wordMatch) return false;
      }
    }

    return true;
  });

  return results;
}

// ─── Describe active filters ─────────────────────────────────

export function describeFilters(filters) {
  if (!filters) return '';
  const parts = [];

  if (filters.ofsted) parts.push(filters.ofsted);
  if (filters.phase) parts.push(filters.phase.toLowerCase());
  if (filters.typeQuery) parts.push(filters.typeQuery);
  if (filters.faithQuery) parts.push(filters.faithQuery);
  parts.push('schools');

  if (filters.locationQuery) parts.push(`in ${filters.locationQuery}`);
  if (filters.region) parts.push(`in ${filters.region}`);
  if (filters.postcodeQuery) parts.push(`near ${filters.postcodeQuery}`);
  if (filters.trustQuery) parts.push(`(${filters.trustQuery})`);

  if (filters.minAttainment8) parts.push(`A8 > ${filters.minAttainment8}`);
  if (filters.minProgress8) parts.push(`P8 > ${filters.minProgress8}`);
  if (filters.minPupils) parts.push(`> ${filters.minPupils} pupils`);
  if (filters.fuzzyQuery) return `"${filters.fuzzyQuery}"`;

  return parts.join(' ');
}
