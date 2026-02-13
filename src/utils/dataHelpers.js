/**
 * Data utilities for school metrics, contextualisation, and statistics
 */

// ─── Ofsted helpers ──────────────────────────────────────────
export function getOfstedColor(rating) {
  switch (rating) {
    case 'Outstanding': return 'var(--ofsted-outstanding)';
    case 'Good': return 'var(--ofsted-good)';
    case 'Requires improvement': return 'var(--ofsted-ri)';
    case 'Requires Improvement': return 'var(--ofsted-ri)';
    case 'Inadequate': return 'var(--ofsted-inadequate)';
    default: return 'var(--ofsted-none)';
  }
}

export function getOfstedLabel(rating) {
  if (!rating || rating === 'Not inspected' || rating === 'null') return 'Not yet inspected';
  return rating;
}

// ─── Phase helpers ───────────────────────────────────────────
export function getPhaseColor(phase) {
  switch (phase) {
    case 'Primary': return 'var(--phase-primary)';
    case 'Secondary': return 'var(--phase-secondary)';
    case 'Special': return 'var(--phase-violet)';
    default: return 'var(--phase-other)';
  }
}

// ─── Metric contextualisation ────────────────────────────────
/**
 * Calculate national percentile for a given metric value
 * Returns an object with percentile, label, and color
 */
export function contextualiseMetric(value, allValues, metricName) {
  if (value == null || !allValues || allValues.length === 0) {
    return { percentile: null, label: 'No data', color: 'var(--color-muted)' };
  }

  const sorted = [...allValues].sort((a, b) => a - b);
  const position = sorted.filter(v => v < value).length;
  const percentile = Math.round((position / sorted.length) * 100);

  let label, color;
  if (percentile >= 90) { label = 'Top 10%'; color = 'var(--ofsted-outstanding)'; }
  else if (percentile >= 75) { label = 'Top 25%'; color = 'var(--color-teal)'; }
  else if (percentile >= 50) { label = 'Above average'; color = 'var(--ofsted-good)'; }
  else if (percentile >= 25) { label = 'Below average'; color = 'var(--ofsted-ri)'; }
  else { label = 'Bottom 25%'; color = 'var(--ofsted-inadequate)'; }

  return { percentile, label, color };
}

/**
 * Compute summary stats for a set of schools
 */
export function computeStats(schools) {
  const total = schools.length;
  const phases = {};
  const ofstedCounts = {};
  const regions = {};

  let totalPupils = 0;
  const a8Values = [];
  const p8Values = [];

  schools.forEach(s => {
    // Phase breakdown
    phases[s.phase] = (phases[s.phase] || 0) + 1;

    // Ofsted breakdown
    const ofsted = getOfstedLabel(s.ofsted);
    ofstedCounts[ofsted] = (ofstedCounts[ofsted] || 0) + 1;

    // Region breakdown
    if (s.region) regions[s.region] = (regions[s.region] || 0) + 1;

    // Pupils
    if (s.pupils) totalPupils += s.pupils;

    // Performance
    if (s.attainment8 != null) a8Values.push(s.attainment8);
    if (s.progress8 != null) p8Values.push(s.progress8);
  });

  return {
    total,
    totalPupils,
    phases,
    ofstedCounts,
    regions,
    attainment8: {
      values: a8Values,
      mean: a8Values.length ? (a8Values.reduce((a, b) => a + b, 0) / a8Values.length).toFixed(1) : null,
      median: a8Values.length ? sorted(a8Values)[Math.floor(a8Values.length / 2)].toFixed(1) : null,
    },
    progress8: {
      values: p8Values,
      mean: p8Values.length ? (p8Values.reduce((a, b) => a + b, 0) / p8Values.length).toFixed(2) : null,
    },
  };
}

function sorted(arr) {
  return [...arr].sort((a, b) => a - b);
}

// ─── Number formatting ───────────────────────────────────────
export function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-GB');
}

export function formatPercent(n) {
  if (n == null) return '—';
  return `${n}%`;
}

export function formatScore(n, decimals = 1) {
  if (n == null) return '—';
  return Number(n).toFixed(decimals);
}

// ─── Generate shareable URL slug ─────────────────────────────
export function schoolSlug(school) {
  return `/school/${school.urn}`;
}
