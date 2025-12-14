import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../services/api';
import type { VoteInput } from '../types';
import {
  getPendingSyncItems,
  updateSyncItem,
  deleteSyncItem,
  addToSyncQueue,
  SyncQueueItem,
} from '../utils/offlineStorage';

interface OfflineContextType {
  isOnline: boolean;
  pendingSyncCount: number;
  syncNow: () => Promise<void>;
  queueVoteSubmission: (eventId: string, data: VoteInput, eventDeadline: string) => Promise<void>;
  queueVoteDeletion: (eventId: string, eventDeadline: string) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Update online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Count pending items
  const updatePendingCount = useCallback(async () => {
    const items = await getPendingSyncItems();
    setPendingSyncCount(items.length);
  }, []);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  // Sync pending items when coming back online
  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const items = await getPendingSyncItems();

      for (const item of items) {
        await processQueueItem(item);
      }
    } finally {
      setIsSyncing(false);
      await updatePendingCount();
    }
  }, [isSyncing, isOnline, updatePendingCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingSyncCount > 0) {
      syncNow();
    }
  }, [isOnline, pendingSyncCount, syncNow]);

  // Process a single queue item
  const processQueueItem = async (item: SyncQueueItem) => {
    if (!item.id) return;

    try {
      // Mark as syncing
      await updateSyncItem(item.id, { status: 'syncing' });

      if (item.type === 'vote') {
        if (item.action === 'submit') {
          const response = await api.submitVote(item.eventId, item.data as VoteInput);
          if (response.success) {
            await deleteSyncItem(item.id);
          } else {
            throw new Error(response.error || 'Failed to submit vote');
          }
        } else if (item.action === 'delete') {
          const response = await api.deleteMyVote(item.eventId);
          if (response.success) {
            await deleteSyncItem(item.id);
          } else {
            throw new Error(response.error || 'Failed to delete vote');
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if it's a deadline error - if so, remove from queue
      if (errorMessage.includes('deadline') || errorMessage.includes('Voting deadline')) {
        await deleteSyncItem(item.id!);
        return;
      }

      // Mark as failed and increment attempts
      await updateSyncItem(item.id!, {
        status: 'failed',
        attempts: item.attempts + 1,
        lastError: errorMessage,
      });

      // If too many attempts, remove from queue
      if (item.attempts >= 3) {
        await deleteSyncItem(item.id!);
      }
    }
  };

  // Queue a vote submission for when back online
  const queueVoteSubmission = useCallback(
    async (eventId: string, data: VoteInput, eventDeadline: string) => {
      // Check if deadline has already passed
      if (new Date(eventDeadline) < new Date()) {
        throw new Error('Voting deadline has passed. Cannot queue vote.');
      }

      await addToSyncQueue({
        type: 'vote',
        action: 'submit',
        eventId,
        data,
        status: 'pending',
        createdAt: Date.now(),
        attempts: 0,
      });

      await updatePendingCount();
    },
    [updatePendingCount]
  );

  // Queue a vote deletion for when back online
  const queueVoteDeletion = useCallback(
    async (eventId: string, eventDeadline: string) => {
      // Check if deadline has already passed
      if (new Date(eventDeadline) < new Date()) {
        throw new Error('Voting deadline has passed. Cannot queue deletion.');
      }

      await addToSyncQueue({
        type: 'vote',
        action: 'delete',
        eventId,
        status: 'pending',
        createdAt: Date.now(),
        attempts: 0,
      });

      await updatePendingCount();
    },
    [updatePendingCount]
  );

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingSyncCount,
        syncNow,
        queueVoteSubmission,
        queueVoteDeletion,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
