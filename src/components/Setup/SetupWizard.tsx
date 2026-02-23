import { useState } from 'react';
import { parseTrackerIntent } from '../../services/aiParser';
import { createSpreadsheet } from '../../services/sheets';
import { saveTrackerConfig } from '../../services/firestore';
import { useAuth } from '../../contexts/AuthContext';
import type { ParsedTrackerIntent, TrackerConfig } from '../../types';

const EXAMPLES = [
  'Track Pokémon cards I buy, purchase price, date, seller, and calculate total spend',
  'Calculate cashback at a fixed rate (default 2%) and show total cashback earned',
  'Create a personal budget tracker with categories and monthly summaries',
  'Track my gym workout sessions with exercise, sets, reps, and weight',
];

interface Props {
  onCreated: (config: TrackerConfig) => void;
}

export default function SetupWizard({ onCreated }: Props) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [step, setStep] = useState<'input' | 'preview' | 'creating'>('input');
  const [parsed, setParsed] = useState<ParsedTrackerIntent | null>(null);
  const [error, setError] = useState('');
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>({});

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;

  const handleParse = async () => {
    if (!input.trim()) return;
    setError('');
    setStep('creating');
    try {
      const result = await parseTrackerIntent(input, apiKey);
      setParsed(result);
      setStep('preview');
    } catch {
      setError('Failed to parse your request. Please try again.');
      setStep('input');
    }
  };

  const handleCreate = async () => {
    if (!parsed || !user) return;
    if (!user.accessToken) {
      setError('Please sign in again so we can access your Google Sheets.');
      return;
    }

    setStep('creating');
    setError('');
    try {
      // Create the Google Spreadsheet
      const { sheetId, sheetUrl } = await createSpreadsheet(
        {
          title: parsed.title,
          description: parsed.description,
          columns: parsed.columns,
          summaryFormulas: parsed.summaryFormulas,
          cashbackRate: parsed.cashbackRate,
        },
        user.accessToken,
      );

      // Save tracker config to Firestore
      const config = await saveTrackerConfig({
        userId: user.uid,
        title: parsed.title,
        description: parsed.description,
        columns: parsed.columns,
        summaryFormulas: parsed.summaryFormulas,
        sheetId,
        sheetUrl,
        cashbackRate: parsed.cashbackRate,
      });

      onCreated(config);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to create tracker: ${msg}`);
      setStep('preview');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {step === 'input' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">What do you want to track?</h2>
          <p className="text-gray-500 mb-6">Describe it in plain English and we'll build the spreadsheet for you.</p>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Track Pokémon cards I buy, purchase price, date, seller, and calculate total spend"
            rows={4}
            className="w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 resize-none outline-none transition-colors"
          />

          {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleParse}
            disabled={!input.trim()}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Generate Tracker →
          </button>

          <div className="mt-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">Examples</p>
            <div className="space-y-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="w-full text-left text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-100 rounded-lg px-4 py-2.5 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'creating' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            {parsed ? 'Creating your spreadsheet…' : 'Analysing your request…'}
          </p>
        </div>
      )}

      {step === 'preview' && parsed && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{parsed.title}</h2>
              <p className="text-gray-500 text-sm mt-1">{parsed.description}</p>
            </div>
            <button
              onClick={() => setStep('input')}
              className="text-gray-400 hover:text-gray-600 text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            >
              ← Edit
            </button>
          </div>

          {/* Column preview */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Columns ({parsed.columns.length})</h3>
            <div className="flex flex-wrap gap-2">
              {parsed.columns.map((col) => (
                <span
                  key={col.name}
                  className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg px-3 py-1 text-sm"
                >
                  <span className="text-xs text-blue-400">{typeIcon(col.type)}</span>
                  {col.name}
                  {col.formula && <span className="text-xs text-blue-400 font-mono">fx</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Summary formulas */}
          {parsed.summaryFormulas.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Auto-calculated summaries</h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                {parsed.summaryFormulas.map((f) => (
                  <div key={f.label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">{f.label}</span>
                    <code className="text-green-700 bg-green-50 px-2 py-0.5 rounded font-mono text-xs">{f.formula}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed.cashbackRate !== undefined && (
            <div className="mb-6 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
              💳 Cashback rate: <strong>{(parsed.cashbackRate * 100).toFixed(1)}%</strong> — automatically calculated per row
            </div>
          )}

          {/* Clarifying questions */}
          {parsed.clarifyingQuestions && parsed.clarifyingQuestions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">A few quick questions</h3>
              <div className="space-y-4">
                {parsed.clarifyingQuestions.map((q) => (
                  <div key={q.fieldName}>
                    <label className="block text-sm text-gray-700 mb-1">{q.question}</label>
                    {q.options ? (
                      <select
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        value={clarifyAnswers[q.fieldName] ?? ''}
                        onChange={(e) => setClarifyAnswers((prev) => ({ ...prev, [q.fieldName]: e.target.value }))}
                      >
                        <option value="">Select…</option>
                        {q.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        value={clarifyAnswers[q.fieldName] ?? ''}
                        onChange={(e) => setClarifyAnswers((prev) => ({ ...prev, [q.fieldName]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="mb-4 text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleCreate}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Create Spreadsheet & Tracker ✨
          </button>
        </div>
      )}
    </div>
  );
}

function typeIcon(type: string): string {
  switch (type) {
    case 'date': return '📅';
    case 'currency': return '💰';
    case 'number': return '#';
    case 'percentage': return '%';
    default: return 'T';
  }
}
