export type ScreenMode = 'home' | 'play' | 'results' | 'editor';

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
  format: 'deep-dive';
  version: 2;
  title: string;
  description: string;
  seconds: number;
  categories: Category[];
  questions: Question[];
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
