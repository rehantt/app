import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { TrackerConfig, DataRow } from '../../types';

interface Props {
  config: TrackerConfig;
  rows: DataRow[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard({ config, rows }: Props) {
  const currencyColumns = config.columns.filter((c) => c.type === 'currency' && !c.formula);
  const dateColumn = config.columns.find((c) => c.type === 'date');

  // ── Summary cards ──────────────────────────────────────────────────────────
  // ── Summary cards ──────────────────────────────────────────────────────────
  type SummaryType = 'currency' | 'count';
  const summaries: { label: string; value: number; type: SummaryType }[] = currencyColumns.map((col) => {
    const total = rows.reduce((sum, r) => sum + (Number(r.values[col.name]) || 0), 0);
    return { label: `Total ${col.name}`, value: total, type: 'currency' };
  });

  if (config.cashbackRate !== undefined) {
    const priceCol = currencyColumns[0];
    if (priceCol) {
      const totalCashback = rows.reduce(
        (sum, r) => sum + (Number(r.values[priceCol.name]) || 0) * (config.cashbackRate ?? 0.02),
        0,
      );
      summaries.push({ label: 'Total Cashback', value: totalCashback, type: 'currency' });
    }
  }

  summaries.push({ label: 'Total Entries', value: rows.length, type: 'count' });

  // ── Monthly spend chart ────────────────────────────────────────────────────
  const monthlyData: Record<string, number> = {};
  if (dateColumn && currencyColumns.length > 0) {
    const priceCol = currencyColumns[0];
    rows.forEach((r) => {
      const dateStr = r.values[dateColumn.name];
      if (!dateStr) return;
      const month = String(dateStr).slice(0, 7); // YYYY-MM
      monthlyData[month] = (monthlyData[month] ?? 0) + (Number(r.values[priceCol.name]) || 0);
    });
  }
  const monthlyChartData = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month: formatMonth(month), total }));

  // ── Category breakdown (if category column exists) ────────────────────────
  const categoryColumn = config.columns.find(
    (c) => c.type === 'text' && c.name.toLowerCase().includes('categ'),
  );
  const categoryData: Record<string, number> = {};
  if (categoryColumn && currencyColumns.length > 0) {
    const priceCol = currencyColumns[0];
    rows.forEach((r) => {
      const cat = String(r.values[categoryColumn.name] ?? 'Other');
      categoryData[cat] = (categoryData[cat] ?? 0) + (Number(r.values[priceCol.name]) || 0);
    });
  }
  const pieData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>Add some entries to see your dashboard charts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {summaries.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {s.type === 'currency'
                ? `$${Number(s.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      {monthlyChartData.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, 'Total']} />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Single-month line chart */}
      {monthlyChartData.length === 1 && currencyColumns.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Spend Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={rows.map((r, i) => ({
                index: i + 1,
                value: Number(r.values[currencyColumns[0].name]) || 0,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="index" tick={{ fontSize: 12 }} label={{ value: 'Entry #', position: 'insideBottom', offset: -2, fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, currencyColumns[0].name]} />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category pie chart */}
      {pieData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">By Category</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip formatter={(v: number | undefined) => `$${(v ?? 0).toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1);
  return d.toLocaleString('default', { month: 'short', year: '2-digit' });
}
