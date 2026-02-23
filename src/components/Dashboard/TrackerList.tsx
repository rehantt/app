import { useState, useEffect } from 'react';
import { listTrackerConfigs, deleteTrackerConfig } from '../../services/firestore';
import { useAuth } from '../../contexts/AuthContext';
import type { TrackerConfig } from '../../types';

interface Props {
  onSelect: (config: TrackerConfig) => void;
  onCreateNew: () => void;
  refreshKey?: number;
}

export default function TrackerList({ onSelect, onCreateNew, refreshKey = 0 }: Props) {
  const { user } = useAuth();
  const [trackers, setTrackers] = useState<TrackerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    listTrackerConfigs(user.uid)
      .then(setTrackers)
      .finally(() => setLoading(false));
  }, [user, refreshKey]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this tracker? The Google Sheet will not be deleted.')) return;
    setDeleting(id);
    try {
      await deleteTrackerConfig(id);
      setTrackers((t) => t.filter((c) => c.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">My Trackers</h2>
        <button
          onClick={onCreateNew}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-xl text-sm transition-colors flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> New Tracker
        </button>
      </div>

      {trackers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No trackers yet</h3>
          <p className="text-gray-400 mb-6">Describe what you want to track and we'll build it for you.</p>
          <button
            onClick={onCreateNew}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl"
          >
            Create your first tracker
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trackers.map((tracker) => (
            <div
              key={tracker.id}
              onClick={() => onSelect(tracker)}
              className="bg-white rounded-2xl border border-gray-100 p-6 hover:border-blue-200 hover:shadow-md cursor-pointer transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <button
                  onClick={(e) => handleDelete(tracker.id, e)}
                  disabled={deleting === tracker.id}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg px-2 py-1 transition-all"
                >
                  {deleting === tracker.id ? '…' : 'Delete'}
                </button>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-700 transition-colors">{tracker.title}</h3>
              <p className="text-xs text-gray-400 mb-3 line-clamp-2">{tracker.description}</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                  {tracker.columns.length} columns
                </span>
                {tracker.cashbackRate && (
                  <span className="bg-amber-50 border border-amber-100 text-amber-600 rounded-lg px-2 py-1">
                    {(tracker.cashbackRate * 100).toFixed(0)}% cashback
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
