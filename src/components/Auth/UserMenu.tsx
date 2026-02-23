import { useAuth } from '../../contexts/AuthContext';

export default function UserMenu() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      {user.photoURL && (
        <img
          src={user.photoURL}
          alt={user.displayName ?? 'User'}
          className="w-8 h-8 rounded-full border-2 border-white/30"
        />
      )}
      <span className="text-sm text-white/90 hidden sm:block">{user.displayName}</span>
      <button
        onClick={signOut}
        className="text-xs text-white/70 hover:text-white border border-white/30 hover:border-white/60 rounded-lg px-3 py-1.5 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
