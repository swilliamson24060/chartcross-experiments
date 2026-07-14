import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export const LEADERBOARD_SIZE = 40;
export const MAX_NAME_LENGTH = 12;

const scoresCollection = collection(db, "scores");

export interface LeaderboardEntry {
  name: string;
  score: number;
}

/** Strips anything that isn't safe to display, and enforces the same length limit as the Firestore rules. */
export function sanitizeName(raw: string): string {
  return raw.trim().slice(0, MAX_NAME_LENGTH);
}

export async function submitScore(name: string, score: number): Promise<void> {
  const cleanName = sanitizeName(name);
  if (!cleanName) throw new Error("Name is required.");
  if (!Number.isInteger(score) || score < 0) throw new Error("Invalid score.");

  await addDoc(scoresCollection, {
    name: cleanName,
    score,
    createdAt: serverTimestamp(),
  });
}

export async function fetchTop40(): Promise<LeaderboardEntry[]> {
  const q = query(scoresCollection, orderBy("score", "desc"), limit(LEADERBOARD_SIZE));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return { name: data.name as string, score: data.score as number };
  });
}
