import { WifiOff, RefreshCw, Cloud } from 'lucide-react';
import { useOffline } from '../../context/OfflineContext';
import { cn } from '../../utils/cn';

export default function OfflineIndicator() {
  const { isOnline, pendingSyncCount, syncNow } = useOffline();

  // Don't show anything when online with no pending items
  if (isOnline && pendingSyncCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all',
        isOnline
          ? 'bg-amber-500 text-white'
          : 'bg-gray-700 text-white'
      )}
    >
      {isOnline ? (
        <>
          <Cloud className="w-4 h-4" />
          <span>{pendingSyncCount} pending</span>
          <button
            onClick={syncNow}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
            title="Sync now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>You're offline</span>
          {pendingSyncCount > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {pendingSyncCount} queued
            </span>
          )}
        </>
      )}
    </div>
  );
}
