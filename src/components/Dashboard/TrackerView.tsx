import { useState, useEffect } from 'react';
import { listDataRows } from '../../services/firestore';
import DataGrid from '../DataGrid/DataGrid';
import Dashboard from '../Dashboard/Dashboard';
import type { TrackerConfig, DataRow } from '../../types';

interface Props {
  config: TrackerConfig;
  onBack: () => void;
}

type Tab = 'dashboard' | 'data';

export default function TrackerView({ config, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDataRows(config.id)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [config.id]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg border border-gray-200 hover:border-gray-300"
            aria-label="Back"
          >
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{config.title}</h1>
            <p className="text-sm text-gray-500">{config.description}</p>
          </div>
        </div>
        <a
          href={config.sheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 rounded-xl px-4 py-2 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
          Open Sheet
        </a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['dashboard', 'data'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t === 'dashboard' ? '📊 Dashboard' : '📋 Data'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {tab === 'dashboard' && <Dashboard config={config} rows={rows} />}
          {tab === 'data' && <DataGrid config={config} rows={rows} onRowsChange={setRows} />}
        </>
      )}
    </div>
  );
}
