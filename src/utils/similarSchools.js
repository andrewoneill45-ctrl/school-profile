/**
 * Similar Schools Engine
 * 
 * Methodology: Weighted Euclidean distance across normalised contextual dimensions.
 * Schools must match on phase and gender. Then ranked by weighted distance
 * across intake characteristics (NOT outcomes).
 * 
 * Dimensions & Weights:
 *   FSM %           (25%) - Primary proxy for socioeconomic disadvantage
 *   SEN EHCP %      (12%) - Complexity of need (EHCP = highest need)
 *   SEN K %          (13%) - Breadth of SEN support provision
 *   EAL %           (15%) - Language diversity of intake
 *   School size     (10%) - Operational scale
 *   Stability %     (10%) - Pupil mobility/turbulence
 *   Region match    (15%) - Labour market, culture, geography
 *     (same region = 0, adjacent = 0.3, different = 1.0)
 */

const WEIGHTS = {
  fsm_pct: 0.25,
  sen_ehcp_pct: 0.12,
  sen_k_pct: 0.13,
  eal_pct: 0.15,
  pupils: 0.10,
  stability_pct: 0.10,
  region: 0.15,
};

// Region adjacency groups (schools in adjacent regions are closer than distant ones)
const REGION_GROUPS = {
  'London': ['London', 'South East'],
  'South East': ['South East', 'London', 'South West', 'East of England'],
  'South West': ['South West', 'South East'],
  'East of England': ['East of England', 'South East', 'London', 'East Midlands'],
  'East Midlands': ['East Midlands', 'West Midlands', 'East of England', 'Yorkshire and The Humber'],
  'West Midlands': ['West Midlands', 'East Midlands', 'North West'],
  'Yorkshire and The Humber': ['Yorkshire and The Humber', 'East Midlands', 'North East', 'North West'],
  'North West': ['North West', 'West Midlands', 'Yorkshire and The Humber', 'North East'],
  'North East': ['North East', 'Yorkshire and The Humber', 'North West'],
};

// Pre-compute normalisation ranges per phase
let normCache = {};

function buildNormRanges(schools) {
  normCache = {};
  const phases = ['Primary', 'Secondary', 'All-through', 'Special'];
  const fields = ['fsm_pct', 'sen_ehcp_pct', 'sen_k_pct', 'eal_pct', 'pupils', 'stability_pct'];
  
  phases.forEach(phase => {
    const group = schools.filter(s => s.phase === phase);
    normCache[phase] = {};
    fields.forEach(f => {
      const vals = group.map(s => s[f]).filter(v => v != null);
      if (vals.length < 10) return;
      vals.sort((a, b) => a - b);
      // Use 5th-95th percentile to reduce outlier impact
      const p5 = vals[Math.floor(vals.length * 0.05)];
      const p95 = vals[Math.floor(vals.length * 0.95)];
      normCache[phase][f] = { min: p5, max: p95, range: p95 - p5 || 1 };
    });
  });
}

function normalise(val, phase, field) {
  const nr = normCache[phase]?.[field];
  if (!nr || val == null) return null;
  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, (val - nr.min) / nr.range));
}

function regionDistance(r1, r2) {
  if (!r1 || !r2) return 0.5; // unknown = neutral
  if (r1 === r2) return 0;
  const adj = REGION_GROUPS[r1];
  if (adj && adj.includes(r2)) return 0.3;
  return 1.0;
}

/**
 * Find the N most similar schools to the target.
 * @param {Object} target - The target school object
 * @param {Array} allSchools - All schools
 * @param {number} n - Number of similar schools to return (default 10)
 * @returns {Array} Similar schools with similarity scores
 */
export function findSimilarSchools(target, allSchools, n = 10) {
  if (!target || !allSchools) return [];
  
  // Build norm ranges if not cached
  if (!normCache[target.phase]) {
    buildNormRanges(allSchools);
  }
  
  const phase = target.phase;
  const gender = target.gender;
  
  // Hard filters: same phase, same gender
  const candidates = allSchools.filter(s => 
    s.urn !== target.urn &&
    s.phase === phase &&
    s.gender === gender &&
    s.fsm_pct != null // Must have basic context data
  );
  
  // Check target has enough data
  const tFields = ['fsm_pct', 'sen_ehcp_pct', 'sen_k_pct', 'eal_pct', 'pupils', 'stability_pct'];
  const tAvailable = tFields.filter(f => target[f] != null);
  if (tAvailable.length < 3) return []; // Need at least 3 dimensions
  
  // Normalise target
  const tNorm = {};
  tAvailable.forEach(f => { tNorm[f] = normalise(target[f], phase, f); });
  
  // Score each candidate
  const scored = candidates.map(s => {
    let totalWeight = 0;
    let weightedSqDist = 0;
    
    // Continuous dimensions
    tAvailable.forEach(f => {
      const sNorm = normalise(s[f], phase, f);
      if (sNorm == null || tNorm[f] == null) return;
      const w = WEIGHTS[f] || 0;
      const diff = tNorm[f] - sNorm;
      weightedSqDist += w * diff * diff;
      totalWeight += w;
    });
    
    // Region dimension
    const rDist = regionDistance(target.region, s.region);
    const rw = WEIGHTS.region;
    weightedSqDist += rw * rDist * rDist;
    totalWeight += rw;
    
    if (totalWeight === 0) return null;
    
    // Normalise by total weight used (handles missing data)
    const distance = Math.sqrt(weightedSqDist / totalWeight);
    const similarity = Math.round((1 - distance) * 100);
    
    return { school: s, distance, similarity };
  }).filter(Boolean);
  
  // Sort by distance (ascending = most similar first)
  scored.sort((a, b) => a.distance - b.distance);
  
  return scored.slice(0, n);
}

/**
 * Get a human-readable explanation of why schools are similar
 */
export function similarityExplanation(target, similar) {
  const s = similar.school;
  const parts = [];
  
  if (target.fsm_pct != null && s.fsm_pct != null) {
    const diff = Math.abs(target.fsm_pct - s.fsm_pct);
    if (diff < 5) parts.push('very similar FSM levels');
    else if (diff < 10) parts.push('similar FSM levels');
  }
  
  if (target.sen_all_pct != null && s.sen_all_pct != null) {
    const diff = Math.abs(target.sen_all_pct - s.sen_all_pct);
    if (diff < 5) parts.push('comparable SEN profile');
  }
  
  if (target.eal_pct != null && s.eal_pct != null) {
    const diff = Math.abs(target.eal_pct - s.eal_pct);
    if (diff < 10) parts.push('similar EAL proportion');
  }
  
  if (target.region === s.region) parts.push('same region');
  
  if (target.pupils != null && s.pupils != null) {
    const ratio = Math.min(target.pupils, s.pupils) / Math.max(target.pupils, s.pupils);
    if (ratio > 0.7) parts.push('similar school size');
  }
  
  return parts.slice(0, 3).join(', ');
}
