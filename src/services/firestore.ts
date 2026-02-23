import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { TrackerConfig, DataRow } from '../types';

// ─── Tracker configs ──────────────────────────────────────────────────────────

export async function saveTrackerConfig(
  config: Omit<TrackerConfig, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<TrackerConfig> {
  const id = config.id ?? doc(collection(db, 'trackers')).id;
  const ref = doc(db, 'trackers', id);
  const now = serverTimestamp();
  const data = {
    ...config,
    id,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, data);
  return { ...config, id, createdAt: new Date(), updatedAt: new Date() } as TrackerConfig;
}

export async function getTrackerConfig(id: string): Promise<TrackerConfig | null> {
  const snap = await getDoc(doc(db, 'trackers', id));
  if (!snap.exists()) return null;
  return firestoreToTracker(snap.data());
}

export async function listTrackerConfigs(userId: string): Promise<TrackerConfig[]> {
  const q = query(
    collection(db, 'trackers'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => firestoreToTracker(d.data()));
}

export async function updateTrackerConfig(
  id: string,
  updates: Partial<TrackerConfig>,
): Promise<void> {
  await updateDoc(doc(db, 'trackers', id), { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteTrackerConfig(id: string): Promise<void> {
  await deleteDoc(doc(db, 'trackers', id));
}

// ─── Data rows ────────────────────────────────────────────────────────────────

export async function saveDataRow(row: Omit<DataRow, 'createdAt' | 'updatedAt'>): Promise<DataRow> {
  const ref = doc(db, 'rows', row.id);
  const now = serverTimestamp();
  await setDoc(ref, { ...row, createdAt: now, updatedAt: now });
  return { ...row, createdAt: new Date(), updatedAt: new Date() };
}

export async function listDataRows(trackerId: string): Promise<DataRow[]> {
  const q = query(
    collection(db, 'rows'),
    where('trackerId', '==', trackerId),
    orderBy('rowIndex', 'asc'),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => firestoreToRow(d.data()));
}

export async function updateDataRow(
  id: string,
  updates: Partial<DataRow>,
): Promise<void> {
  await updateDoc(doc(db, 'rows', id), { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteDataRow(id: string): Promise<void> {
  await deleteDoc(doc(db, 'rows', id));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tsToDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date();
}

function firestoreToTracker(data: Record<string, unknown>): TrackerConfig {
  return {
    ...(data as unknown as TrackerConfig),
    createdAt: tsToDate(data.createdAt),
    updatedAt: tsToDate(data.updatedAt),
  };
}

function firestoreToRow(data: Record<string, unknown>): DataRow {
  return {
    ...(data as unknown as DataRow),
    createdAt: tsToDate(data.createdAt),
    updatedAt: tsToDate(data.updatedAt),
  };
}
