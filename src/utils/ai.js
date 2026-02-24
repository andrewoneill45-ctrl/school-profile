/**
 * AI Utility - shared Claude API interface
 * Uses VITE_ANTHROPIC_KEY from environment
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_KEY = import.meta.env.VITE_ANTHROPIC_KEY || '';
const MODEL = 'claude-sonnet-4-20250514';

export async function callClaude({ system, messages, maxTokens = 1024 }) {
  if (!API_KEY) throw new Error('No API key configured. Set VITE_ANTHROPIC_KEY in .env');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.map(c => c.text || '').join('') || '';
}

/**
 * AI-powered search: parse natural language into filter object
 */
export async function aiParseSearch(query, sampleLAs, sampleTrusts) {
  const system = `You are a search parser for an English schools data explorer. Convert natural language queries into a JSON filter object.

Available filter keys:
- phase: "Primary" | "Secondary" | "Special" | "All-through"
- ofsted: "Outstanding" | "Good" | "Requires improvement" | "Inadequate"
- ofstedMulti: array of ofsted values (e.g. ["Outstanding", "Good"])
- region: "London" | "South East" | "South West" | "East of England" | "East Midlands" | "West Midlands" | "Yorkshire and The Humber" | "North West" | "North East"
- locationQuery: LA name or town (lowercase) e.g. "camden", "sunderland", "bristol"
- trustQuery: trust name (lowercase) e.g. "harris", "ark", "dixons"
- typeQuery: "academy" | "free school" | "maintained" | "grammar"
- faithQuery: "Roman Catholic" | "Church of England" | "Jewish" | "Muslim" | "_any_faith"
- gender: "Boys" | "Girls"
- minAttainment8 / maxAttainment8: number (typical range 20-70)
- minProgress8 / maxProgress8: number (typical range -2 to +2)
- minFSM / maxFSM: number (percentage 0-100)
- minPupils / maxPupils: number
- postcodeQuery: postcode prefix e.g. "SW1", "M1"
- fuzzyQuery: freetext search string (use as last resort for school names etc)
- nameQuery: specific school name to search for

Some LA names in the data: ${sampleLAs.slice(0, 30).join(', ')}.
Some trust names: ${sampleTrusts.slice(0, 20).join(', ')}.

RULES:
- Return ONLY valid JSON, no explanation, no markdown
- Use the most specific filters possible
- If the query mentions a place name, use locationQuery (not region) unless it's clearly a region
- For "best" or "top performing", use minAttainment8: 55+
- For "struggling" or "underperforming", use maxAttainment8: 38
- For "high disadvantage" or "deprived", use minFSM: 40+
- If the query is just a school name or proper noun you don't recognise, use fuzzyQuery
- For "good or outstanding" use ofstedMulti: ["Outstanding", "Good"]`;

  const reply = await callClaude({
    system,
    messages: [{ role: 'user', content: query }],
    maxTokens: 300,
  });

  // Parse JSON from reply
  const cleaned = reply.replace(/```json\s*|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // If AI returned something unparseable, fall back to fuzzy
    return { fuzzyQuery: query };
  }
}

/**
 * AI analytics chat - answer questions about filtered school data
 */
export async function aiAnalytics(query, dataContext, history = []) {
  const system = `You are an expert education data analyst working for the Department for Education in England. You have access to a filtered set of school performance data. Answer questions concisely and precisely using the data provided. Use UK English. Format numbers clearly. Be analytical and insightful — draw out patterns, comparisons, and policy-relevant observations.

If asked to write a briefing, use a structured format with clear sections. Keep responses focused and data-driven.

Here is the aggregated data for the currently filtered set of schools:

${dataContext}`;

  return callClaude({
    system,
    messages: [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: query },
    ],
    maxTokens: 1500,
  });
}

export function hasApiKey() {
  return !!API_KEY;
}
