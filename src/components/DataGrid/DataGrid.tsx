import { useState } from 'react';
import { doc, collection } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { saveDataRow, updateDataRow, deleteDataRow } from '../../services/firestore';
import { appendRow, updateRow, deleteRow, buildRowValues } from '../../services/sheets';
import { useAuth } from '../../contexts/AuthContext';
import type { TrackerConfig, DataRow } from '../../types';

interface Props {
  config: TrackerConfig;
  rows: DataRow[];
  onRowsChange: (rows: DataRow[]) => void;
}

type EditMap = Record<string, Record<string, string>>;

export default function DataGrid({ config, rows, onRowsChange }: Props) {
  const { user } = useAuth();
  const [editMap, setEditMap] = useState<EditMap>({});
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const dataColumns = config.columns.filter((c) => !c.formula);

  const startEdit = (rowId: string, existing: DataRow) => {
    const vals: Record<string, string> = {};
    dataColumns.forEach((c) => {
      vals[c.name] = String(existing.values[c.name] ?? '');
    });
    setEditMap((m) => ({ ...m, [rowId]: vals }));
  };

  const cancelEdit = (rowId: string) => {
    setEditMap((m) => {
      const next = { ...m };
      delete next[rowId];
      return next;
    });
  };

  const saveEdit = async (row: DataRow) => {
    if (!user?.accessToken) { setError('No access token – please sign in again.'); return; }
    const edits = editMap[row.id];
    if (!edits) return;
    setSaving(row.id);
    try {
      const values: DataRow['values'] = {};
      config.columns.forEach((c) => {
        values[c.name] = edits[c.name] ?? row.values[c.name] ?? null;
      });
      await updateDataRow(row.id, { values });
      const flat = buildRowValues(config.columns, values);
      await updateRow(config.sheetId, row.rowIndex, flat, user.accessToken);
      onRowsChange(rows.map((r) => (r.id === row.id ? { ...r, values } : r)));
      cancelEdit(row.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (row: DataRow) => {
    if (!user?.accessToken) { setError('No access token.'); return; }
    if (!confirm('Delete this row?')) return;
    setSaving(row.id);
    try {
      await deleteDataRow(row.id);
      await deleteRow(config.sheetId, row.rowIndex, user.accessToken);
      // Adjust rowIndex for subsequent rows
      onRowsChange(
        rows
          .filter((r) => r.id !== row.id)
          .map((r) => (r.rowIndex > row.rowIndex ? { ...r, rowIndex: r.rowIndex - 1 } : r)),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  };

  const handleAddRow = async () => {
    if (!user?.accessToken) { setError('No access token – please sign in again.'); return; }
    setSaving('new');
    try {
      const values: DataRow['values'] = {};
      config.columns.forEach((c) => {
        const raw = newRow[c.name];
        if (raw !== undefined && raw !== '') {
          values[c.name] = c.type === 'number' || c.type === 'currency' || c.type === 'percentage'
            ? parseFloat(raw) || raw
            : raw;
        } else {
          values[c.name] = null;
        }
      });

      const flat = buildRowValues(config.columns, values);
      const rowIndex = await appendRow(config.sheetId, flat, user.accessToken);
      const id = doc(collection(db, 'rows')).id;
      const saved = await saveDataRow({ id, trackerId: config.id, values, rowIndex });
      onRowsChange([...rows, saved]);
      setNewRow({});
      setAdding(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex justify-between">
          {error}
          <button onClick={() => setError('')} className="ml-4 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {dataColumns.map((col) => (
                <th key={col.name} className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                  <span className="mr-1 text-gray-400">{colTypeIcon(col.type)}</span>
                  {col.name}
                </th>
              ))}
              {config.columns.filter((c) => c.formula).map((col) => (
                <th key={col.name} className="text-left px-4 py-3 font-semibold text-gray-400 whitespace-nowrap">
                  <span className="mr-1">fx</span>{col.name}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !adding && (
              <tr>
                <td colSpan={config.columns.length + 1} className="px-4 py-10 text-center text-gray-400">
                  No entries yet. Add your first row!
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isEditing = !!editMap[row.id];
              const isSaving = saving === row.id;
              return (
                <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${isEditing ? 'bg-blue-50' : ''}`}>
                  {dataColumns.map((col) => (
                    <td key={col.name} className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type={inputType(col.type)}
                          value={editMap[row.id][col.name] ?? ''}
                          onChange={(e) =>
                            setEditMap((m) => ({
                              ...m,
                              [row.id]: { ...m[row.id], [col.name]: e.target.value },
                            }))
                          }
                          className="w-full border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      ) : (
                        <span className={col.type === 'currency' ? 'font-medium text-gray-800' : 'text-gray-700'}>
                          {formatValue(row.values[col.name], col.type)}
                        </span>
                      )}
                    </td>
                  ))}
                  {config.columns.filter((c) => c.formula).map((col) => (
                    <td key={col.name} className="px-4 py-3 text-gray-400 italic text-xs">
                      Calculated in Sheet
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => saveEdit(row)}
                          disabled={isSaving}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {isSaving ? '…' : 'Save'}
                        </button>
                        <button
                          onClick={() => cancelEdit(row.id)}
                          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => startEdit(row.id, row)}
                          className="text-xs text-blue-600 hover:text-blue-800 border border-blue-100 hover:border-blue-300 px-3 py-1.5 rounded-lg"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(row)}
                          disabled={isSaving}
                          className="text-xs text-red-500 hover:text-red-700 border border-red-100 hover:border-red-300 px-3 py-1.5 rounded-lg"
                        >
                          {isSaving ? '…' : 'Del'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Add new row inline */}
            {adding && (
              <tr className="bg-green-50 border-t-2 border-green-200">
                {dataColumns.map((col) => (
                  <td key={col.name} className="px-4 py-3">
                    <input
                      type={inputType(col.type)}
                      placeholder={col.name}
                      value={newRow[col.name] ?? ''}
                      onChange={(e) => setNewRow((r) => ({ ...r, [col.name]: e.target.value }))}
                      className="w-full border border-green-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </td>
                ))}
                {config.columns.filter((c) => c.formula).map((col) => (
                  <td key={col.name} className="px-4 py-3 text-gray-400 italic text-xs">auto</td>
                ))}
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleAddRow}
                      disabled={saving === 'new'}
                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      {saving === 'new' ? '…' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setAdding(false); setNewRow({}); }}
                      className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-xl px-4 py-2.5 transition-colors flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> Add row
        </button>
      )}
    </div>
  );
}

function colTypeIcon(type: string) {
  switch (type) {
    case 'date': return '📅';
    case 'currency': return '💰';
    case 'number': return '#';
    case 'percentage': return '%';
    default: return 'T';
  }
}

function inputType(type: string): string {
  if (type === 'date') return 'date';
  if (type === 'number' || type === 'currency' || type === 'percentage') return 'number';
  return 'text';
}

function formatValue(val: string | number | null | undefined, type: string): string {
  if (val === null || val === undefined) return '—';
  if (type === 'currency') return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (type === 'percentage') return `${(Number(val) * 100).toFixed(1)}%`;
  return String(val);
}
