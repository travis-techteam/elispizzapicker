import { openDB, IDBPDatabase } from 'idb';
import type { Event, PizzaOption, Vote } from '../types';

const DB_NAME = 'eli-pizza-picker';
const DB_VERSION = 1;

interface PizzaPickerDB {
  events: {
    key: string;
    value: Event & { cachedAt: number };
    indexes: { 'by-active': number };
  };
  pizzaOptions: {
    key: string;
    value: PizzaOption & { eventId: string; cachedAt: number };
    indexes: { 'by-event': string };
  };
  myVotes: {
    key: string; // eventId
    value: Vote & { cachedAt: number };
  };
  syncQueue: {
    key: number;
    value: SyncQueueItem;
    indexes: { 'by-status': string };
  };
}

export interface SyncQueueItem {
  id?: number;
  type: 'vote';
  action: 'submit' | 'delete';
  eventId: string;
  data?: unknown;
  status: 'pending' | 'syncing' | 'failed';
  createdAt: number;
  attempts: number;
  lastError?: string;
}

let dbPromise: Promise<IDBPDatabase<PizzaPickerDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PizzaPickerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Events store
        const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
        eventsStore.createIndex('by-active', 'isActive');

        // Pizza options store
        const pizzaStore = db.createObjectStore('pizzaOptions', { keyPath: 'id' });
        pizzaStore.createIndex('by-event', 'eventId');

        // My votes store (keyed by eventId)
        db.createObjectStore('myVotes', { keyPath: 'eventId' });

        // Sync queue store
        const syncStore = db.createObjectStore('syncQueue', {
          keyPath: 'id',
          autoIncrement: true,
        });
        syncStore.createIndex('by-status', 'status');
      },
    });
  }
  return dbPromise;
}

// Event operations
export async function cacheEvent(event: Event): Promise<void> {
  const db = await getDB();
  await db.put('events', { ...event, cachedAt: Date.now() });
}

export async function getCachedEvent(id: string): Promise<Event | undefined> {
  const db = await getDB();
  const event = await db.get('events', id);
  return event;
}

export async function getCachedActiveEvent(): Promise<Event | undefined> {
  const db = await getDB();
  const events = await db.getAllFromIndex('events', 'by-active', 1);
  // Return the most recently cached active event
  return events.sort((a, b) => b.cachedAt - a.cachedAt)[0];
}

export async function getCachedEvents(): Promise<Event[]> {
  const db = await getDB();
  const events = await db.getAll('events');
  return events.sort((a, b) => b.cachedAt - a.cachedAt);
}

// Pizza options operations
export async function cachePizzaOptions(eventId: string, options: PizzaOption[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('pizzaOptions', 'readwrite');

  // Delete old options for this event
  const oldOptions = await tx.store.index('by-event').getAllKeys(eventId);
  for (const key of oldOptions) {
    await tx.store.delete(key);
  }

  // Add new options
  for (const option of options) {
    await tx.store.put({ ...option, eventId, cachedAt: Date.now() });
  }

  await tx.done;
}

export async function getCachedPizzaOptions(eventId: string): Promise<PizzaOption[]> {
  const db = await getDB();
  return db.getAllFromIndex('pizzaOptions', 'by-event', eventId);
}

// My vote operations
export async function cacheMyVote(eventId: string, vote: Vote): Promise<void> {
  const db = await getDB();
  await db.put('myVotes', { ...vote, eventId, cachedAt: Date.now() });
}

export async function getCachedMyVote(eventId: string): Promise<Vote | undefined> {
  const db = await getDB();
  return db.get('myVotes', eventId);
}

export async function deleteCachedMyVote(eventId: string): Promise<void> {
  const db = await getDB();
  await db.delete('myVotes', eventId);
}

// Sync queue operations
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<number> {
  const db = await getDB();
  const id = await db.add('syncQueue', item as SyncQueueItem);
  return id as number;
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-status', 'pending');
}

export async function updateSyncItem(id: number, updates: Partial<SyncQueueItem>): Promise<void> {
  const db = await getDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    await db.put('syncQueue', { ...item, ...updates });
  }
}

export async function deleteSyncItem(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('syncQueue');
}

// Utility to check if cached data is stale (older than 5 minutes)
export function isStale(cachedAt: number, maxAgeMs = 5 * 60 * 1000): boolean {
  return Date.now() - cachedAt > maxAgeMs;
}

// Clear all cached data
export async function clearAllCache(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('events'),
    db.clear('pizzaOptions'),
    db.clear('myVotes'),
  ]);
}
