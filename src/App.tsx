import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/Auth/LoginPage';
import UserMenu from './components/Auth/UserMenu';
import SetupWizard from './components/Setup/SetupWizard';
import TrackerList from './components/Dashboard/TrackerList';
import TrackerView from './components/Dashboard/TrackerView';
import type { TrackerConfig } from './types';

type Screen = 'home' | 'new' | 'tracker';

function AppShell() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState<Screen>('home');
  const [activeTracker, setActiveTracker] = useState<TrackerConfig | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleTrackerCreated = (config: TrackerConfig) => {
    setActiveTracker(config);
    setRefreshKey((k) => k + 1);
    setScreen('tracker');
  };

  const handleSelectTracker = (config: TrackerConfig) => {
    setActiveTracker(config);
    setScreen('tracker');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-blue-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setScreen('home')}
            className="flex items-center gap-2 text-white font-bold text-lg hover:opacity-80 transition-opacity"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            DataTracker
          </button>
          <UserMenu />
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {screen === 'home' && (
          <TrackerList
            onSelect={handleSelectTracker}
            onCreateNew={() => setScreen('new')}
            refreshKey={refreshKey}
          />
        )}
        {screen === 'new' && (
          <SetupWizard onCreated={handleTrackerCreated} />
        )}
        {screen === 'tracker' && activeTracker && (
          <TrackerView
            config={activeTracker}
            onBack={() => setScreen('home')}
          />
        )}
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
