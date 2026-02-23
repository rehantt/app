/**
 * AI parsing service using Google Gemini (via Firebase AI / Vertex AI).
 * Falls back to a rule-based parser when the API is not configured.
 */
import type { ParsedTrackerIntent, TrackerColumn, SummaryFormula } from '../types';

/** Convert a 1-based column index to a spreadsheet column letter (1→A, 27→AA). */
function colLetterFromIndex(n: number): string {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const GEMINI_PROMPT_TEMPLATE = `You are a data-tracker assistant. Parse the following user request and return a JSON object.

User request: "{INPUT}"

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "title": "Short tracker title",
  "description": "One sentence description",
  "columns": [
    { "name": "Column Name", "type": "text|number|date|currency|percentage", "formula": "optional sheet formula" }
  ],
  "summaryFormulas": [
    { "label": "Total Spend", "formula": "=SUM(C2:C1000)", "column": "C" }
  ],
  "cashbackRate": 0.02,
  "clarifyingQuestions": []
}

Rules:
- column types: text, number, date, currency, percentage
- always include an "ID" column of type text as the first column
- always include a "Date" column of type date
- if the user mentions cashback/percentage, set cashbackRate (e.g. 0.02 for 2%) and add a "Cashback" column with formula like "=C2*0.02" where C is the price/amount column letter
- summaryFormulas use placeholder column letters (A, B, C…) matching the column order
- clarifyingQuestions should be an empty array unless the request is genuinely ambiguous`;

/**
 * Call Gemini via the REST API using the user's Firebase-provided API key.
 * In production this would go through a Firebase Cloud Function to keep the key server-side.
 */
async function callGemini(userInput: string, apiKey: string): Promise<ParsedTrackerIntent> {
  const prompt = GEMINI_PROMPT_TEMPLATE.replace('{INPUT}', userInput);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  // Strip any accidental markdown fences
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as ParsedTrackerIntent;
}

/**
 * Fallback rule-based parser for when AI is unavailable.
 */
function ruleBasedParse(userInput: string): ParsedTrackerIntent {
  const lower = userInput.toLowerCase();

  const columns: TrackerColumn[] = [{ name: 'ID', type: 'text' }];
  const summaryFormulas: SummaryFormula[] = [];
  let cashbackRate: number | undefined;

  // Date column is almost always needed
  columns.push({ name: 'Date', type: 'date' });

  // Detect common fields
  if (lower.includes('price') || lower.includes('cost') || lower.includes('spend') || lower.includes('amount')) {
    columns.push({ name: 'Price', type: 'currency' });
    summaryFormulas.push({ label: 'Total Spend', formula: '=SUM(C2:C1000)', column: 'C' });
  }

  if (lower.includes('cashback') || lower.includes('cash back')) {
    // Extract rate if mentioned (e.g. "2%", "1.5%")
    const rateMatch = userInput.match(/(\d+(?:\.\d+)?)\s*%/);
    cashbackRate = rateMatch ? parseFloat(rateMatch[1]) / 100 : 0.02;
    const priceColLetter = columns.length >= 3 ? 'C' : 'B';
    columns.push({
      name: 'Cashback',
      type: 'currency',
      formula: `=${priceColLetter}2*${cashbackRate}`,
    });
    const cashbackColLetter = String.fromCharCode(64 + columns.length);
    summaryFormulas.push({
      label: 'Total Cashback',
      formula: `=SUM(${cashbackColLetter}2:${cashbackColLetter}1000)`,
      column: cashbackColLetter,
    });
  }

  if (lower.includes('seller') || lower.includes('vendor') || lower.includes('store')) {
    columns.push({ name: 'Seller', type: 'text' });
  }

  if (lower.includes('category') || lower.includes('categories')) {
    columns.push({ name: 'Category', type: 'text' });
    // Monthly summary formula
    summaryFormulas.push({ label: 'Count', formula: '=COUNTA(A2:A1000)' });
  }

  if (lower.includes('budget')) {
    columns.push({ name: 'Budget', type: 'currency' });
    columns.push({ name: 'Actual', type: 'currency' });
    const budgetIdx = columns.findIndex((c) => c.name === 'Budget') + 1;
    const actualIdx = columns.findIndex((c) => c.name === 'Actual') + 1;
    const budgetLetter = colLetterFromIndex(budgetIdx);
    const actualLetter = colLetterFromIndex(actualIdx);
    columns.push({ name: 'Variance', type: 'currency', formula: `=${budgetLetter}2-${actualLetter}2` });
  }

  if (lower.includes('note') || lower.includes('description') || lower.includes('comment')) {
    columns.push({ name: 'Notes', type: 'text' });
  }

  // If no price-like column detected, add a generic Value column
  if (!columns.some((c) => c.type === 'currency' || c.type === 'number')) {
    columns.push({ name: 'Value', type: 'number' });
  }

  // Derive a title from the input
  const titleMatch =
    lower.match(/track(?:ing)?\s+(.+?)(?:\s+i\s|,|and\s)/i) ??
    lower.match(/(.+?)\s+tracker/i);
  const title = titleMatch
    ? titleMatch[1].replace(/^[a-z]/, (c) => c.toUpperCase()) + ' Tracker'
    : 'My Data Tracker';

  return {
    title,
    description: userInput,
    columns,
    summaryFormulas,
    cashbackRate,
    clarifyingQuestions: [],
  };
}

export async function parseTrackerIntent(
  userInput: string,
  apiKey?: string,
): Promise<ParsedTrackerIntent> {
  if (apiKey && apiKey !== 'YOUR_API_KEY') {
    try {
      return await callGemini(userInput, apiKey);
    } catch (err) {
      console.warn('Gemini API failed, falling back to rule-based parser:', err);
    }
  }
  return ruleBasedParse(userInput);
}
