import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  GamePack,
  PlayerProfile,
  PublishedPackRecord,
  ScoreEntry,
} from './types/game';
import { slugifyTitle, validatePack } from './utils/pack';

export const ADMIN_EMAIL = 'akhildforever@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function isAdminUser(user: User | null): boolean {
  return Boolean(user && user.email === ADMIN_EMAIL && user.emailVerified);
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutPlayer(): Promise<void> {
  await signOut(auth);
}

export function sanitizePackId(rawId: string): string {
  const cleaned = slugifyTitle(rawId).replace(/[^a-zA-Z0-9_-]/g, '-');
  return (cleaned || 'custom-dive').slice(0, 80);
}

export function subscribePublishedPacks(
  onData: (packs: PublishedPackRecord[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = 'packs';
  const q = query(collection(db, path), orderBy('updatedAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const records: PublishedPackRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        try {
          const validated = validatePack({
            format: d.format,
            version: d.version,
            title: d.title,
            description: d.description,
            seconds: d.seconds,
            categories: d.categories,
            questions: d.questions,
          });
          records.push({
            id: docSnap.id,
            pack: validated,
            featured: Boolean(d.featured),
            eventBanner: typeof d.eventBanner === 'string' ? d.eventBanner : '',
            source: 'cloud',
          });
        } catch {
          // Skip malformed pack records
        }
      });
      onData(records);
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
  );
}

export function subscribeScores(
  onData: (scores: ScoreEntry[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = 'scores';
  const q = query(collection(db, path), orderBy('depth', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const entries: ScoreEntry[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const ts = d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now();
        entries.push({
          id: docSnap.id,
          uid: String(d.uid ?? ''),
          playerName: String(d.playerName ?? 'Anonymous'),
          college: String(d.college ?? ''),
          packId: String(d.packId ?? ''),
          packTitle: String(d.packTitle ?? ''),
          depth: Number(d.depth ?? 0),
          points: Number(d.points ?? 0),
          maxPoints: Number(d.maxPoints ?? 100),
          acceptedCount: Number(d.acceptedCount ?? 0),
          totalQuestions: Number(d.totalQuestions ?? 1),
          emojiGrid: String(d.emojiGrid ?? '🌊'),
          createdAtMs: ts,
        });
      });
      onData(entries);
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
  );
}

export async function loadPlayerProfile(
  uid: string,
): Promise<PlayerProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: String(d.uid ?? uid),
      playerName: String(d.playerName ?? ''),
      college: String(d.college ?? ''),
      email: String(d.email ?? ''),
      bestDepth: Number(d.bestDepth ?? 0),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function upsertPlayerProfile(params: {
  uid: string;
  playerName: string;
  college: string;
  email: string;
  depth: number;
}): Promise<void> {
  const path = `users/${params.uid}`;
  const safeName = params.playerName.trim().slice(0, 80) || 'Diver';
  const safeCollege = params.college.trim().slice(0, 100);
  const safeEmail = params.email.trim().slice(0, 120);
  const safeDepth = Math.max(0, Math.min(1000000, Math.round(params.depth)));

  try {
    const userRef = doc(db, 'users', params.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const existingBest = Number(snap.data().bestDepth ?? 0);
      await updateDoc(userRef, {
        playerName: safeName,
        college: safeCollege,
        email: safeEmail,
        bestDepth: Math.max(existingBest, safeDepth),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, {
        uid: params.uid,
        playerName: safeName,
        college: safeCollege,
        email: safeEmail,
        bestDepth: safeDepth,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function submitScoreEntry(params: {
  uid: string;
  email: string;
  playerName: string;
  college: string;
  packId: string;
  packTitle: string;
  points: number;
  maxPoints: number;
  acceptedCount: number;
  totalQuestions: number;
  emojiGrid: string;
}): Promise<string> {
  const safeName = params.playerName.trim().slice(0, 80);
  if (!safeName) {
    throw new Error('Enter your name so it can be announced for free event entry.');
  }
  const safeCollege = params.college.trim().slice(0, 100);
  const safePackId = sanitizePackId(params.packId);
  const safePackTitle = params.packTitle.trim().slice(0, 120) || 'Krillion Dive';
  const safePoints = Math.max(0, Math.min(100000, Math.round(params.points)));
  const safeDepth = safePoints * 10;
  const safeMaxPoints = Math.max(1, Math.min(100000, Math.round(params.maxPoints)));
  const safeAccepted = Math.max(0, Math.min(100, Math.round(params.acceptedCount)));
  const safeTotalQ = Math.max(1, Math.min(100, Math.round(params.totalQuestions)));
  const safeEmoji = params.emojiGrid.trim().slice(0, 200) || '🌊';

  const scoreId = `${params.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16)}-${Date.now().toString(36)}`;
  const path = `scores/${scoreId}`;

  try {
    await setDoc(doc(db, 'scores', scoreId), {
      uid: params.uid,
      playerName: safeName,
      college: safeCollege,
      packId: safePackId,
      packTitle: safePackTitle,
      depth: safeDepth,
      points: safePoints,
      maxPoints: safeMaxPoints,
      acceptedCount: safeAccepted,
      totalQuestions: safeTotalQ,
      emojiGrid: safeEmoji,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  await upsertPlayerProfile({
    uid: params.uid,
    playerName: safeName,
    college: safeCollege,
    email: params.email,
    depth: safeDepth,
  });

  return scoreId;
}

export async function publishPackToCloud(params: {
  packId: string;
  pack: GamePack;
  featured: boolean;
  eventBanner: string;
  authorUid: string;
}): Promise<string> {
  const safeId = sanitizePackId(params.packId);
  const path = `packs/${safeId}`;
  const validated = validatePack(params.pack);

  try {
    const packRef = doc(db, 'packs', safeId);
    const snap = await getDoc(packRef);
    const payloadFields = {
      format: validated.format,
      title: validated.title.slice(0, 120),
      description: validated.description.slice(0, 2000),
      seconds: Math.round(validated.seconds),
      categories: validated.categories,
      questions: validated.questions,
      featured: params.featured,
      eventBanner: params.eventBanner.trim().slice(0, 200),
      updatedAt: serverTimestamp(),
    };

    if (snap.exists()) {
      await updateDoc(packRef, payloadFields);
    } else {
      await setDoc(packRef, {
        id: safeId,
        version: 2,
        ...payloadFields,
        authorUid: params.authorUid,
        createdAt: serverTimestamp(),
      });
    }
    return safeId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePackFromCloud(packId: string): Promise<void> {
  const safeId = sanitizePackId(packId);
  const path = `packs/${safeId}`;
  try {
    await deleteDoc(doc(db, 'packs', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteScoreFromCloud(scoreId: string): Promise<void> {
  const path = `scores/${scoreId}`;
  try {
    await deleteDoc(doc(db, 'scores', scoreId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAllRegisteredUsers(): Promise<PlayerProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(
      query(collection(db, path), orderBy('bestDepth', 'desc'), limit(200)),
    );
    const users: PlayerProfile[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      users.push({
        uid: String(d.uid ?? docSnap.id),
        playerName: String(d.playerName ?? ''),
        college: String(d.college ?? ''),
        email: String(d.email ?? ''),
        bestDepth: Number(d.bestDepth ?? 0),
      });
    });
    return users;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
