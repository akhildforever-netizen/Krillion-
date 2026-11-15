export type ScreenMode = 'home' | 'play' | 'results' | 'editor' | 'leaderboard';

export interface Category {
  id: string;
  name: string;
  points: number;
  color: string;
}

export interface Answer {
  text: string;
  category: string;
  aliases: string[];
}

export interface Question {
  prompt: string;
  answers: Answer[];
}

export interface GamePack {
  format: 'deep-dive' | 'sapientia';
  version: 2;
  title: string;
  description: string;
  seconds: number;
  categories: Category[];
  questions: Question[];
}

export interface PublishedPackRecord {
  id: string;
  pack: GamePack;
  featured: boolean;
  eventBanner: string;
  source: 'builtin' | 'cloud';
}

export interface RoundResult {
  prompt: string;
  raw: string;
  answer: string | null;
  category: string | null;
  points: number;
  corrected: boolean;
  attempts: number;
}

export type PlayPhase = 'reading' | 'answer' | 'confirm' | 'result' | 'done' | 'abandoned';

export interface RunState {
  index: number;
  total: number;
  results: RoundResult[];
  phase: PlayPhase;
  attempts: number;
  deadline?: number;
  remaining?: number;
}

export interface ScoreEntry {
  id: string;
  uid: string;
  playerName: string;
  college: string;
  packId: string;
  packTitle: string;
  depth: number;
  points: number;
  maxPoints: number;
  acceptedCount: number;
  totalQuestions: number;
  emojiGrid: string;
  createdAtMs: number;
}

export interface PlayerProfile {
  uid: string;
  playerName: string;
  college: string;
  email: string;
  bestDepth: number;
}
