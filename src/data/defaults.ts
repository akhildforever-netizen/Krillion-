import embeddedAssets from './embeddedAssets.json';
import type { Category, GamePack } from '../types/game';

export const ASSETS = embeddedAssets as {
  water: string;
  krill: string;
  rare: string;
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'plankton', name: 'Plankton', points: 10, color: '#afbdcb' },
  { id: 'too-clever', name: 'Too Clever', points: 15, color: '#ffb16b' },
  { id: 'schooler', name: 'Schooler', points: 30, color: '#79cfdf' },
  { id: 'rare', name: 'Rare', points: 60, color: '#6af0bb' },
  { id: 'deep-cut', name: 'Deep Cut', points: 85, color: '#c49aff' },
  { id: 'krillion', name: 'One in a Krillion', points: 100, color: '#ff5896' },
];

export const TIER_EMOJIS: Record<string, string> = {
  plankton: '🫧',
  'too-clever': '🤡',
  schooler: '🐟',
  rare: '🦑',
  'deep-cut': '🏮',
  krillion: '🌟',
};

const rawQuestions: Array<{
  prompt: string;
  answers: Array<[string, number, string]>;
}> = [
  {
    prompt: 'Name a planet in our solar system.',
    answers: [
      ['Earth', 10, 'Terra'],
      ['Mars', 20, ''],
      ['Jupiter', 30, ''],
      ['Saturn', 40, ''],
      ['Venus', 55, ''],
      ['Mercury', 70, ''],
      ['Neptune', 85, ''],
      ['Uranus', 100, ''],
    ],
  },
  {
    prompt: 'Name a piece in standard chess.',
    answers: [
      ['King', 10, ''],
      ['Queen', 20, ''],
      ['Pawn', 35, ''],
      ['Knight', 65, ''],
      ['Bishop', 80, ''],
      ['Rook', 100, ''],
    ],
  },
  {
    prompt: 'Name a country that shares a land border with Myanmar.',
    answers: [
      ['Thailand', 10, ''],
      ['China', 25, ''],
      ['India', 50, ''],
      ['Bangladesh', 80, ''],
      ['Laos', 100, 'Lao PDR'],
    ],
  },
  {
    prompt: 'Name one of the eight living species of bear.',
    answers: [
      ['Polar bear', 10, 'Polar'],
      ['Giant panda', 20, 'Panda|Panda bear'],
      ['Brown bear', 30, 'Brown|Grizzly|Grizzly bear'],
      ['American black bear', 45, 'Black bear'],
      ['Asian black bear', 65, 'Asiatic black bear|Moon bear'],
      ['Sun bear', 80, ''],
      ['Sloth bear', 90, ''],
      ['Spectacled bear', 100, 'Andean bear'],
    ],
  },
  {
    prompt: 'Name one of the five Platonic solids.',
    answers: [
      ['Cube', 10, 'Hexahedron'],
      ['Tetrahedron', 35, ''],
      ['Octahedron', 60, ''],
      ['Dodecahedron', 85, ''],
      ['Icosahedron', 100, ''],
    ],
  },
  {
    prompt: 'Name a month with exactly 30 days.',
    answers: [
      ['April', 10, ''],
      ['June', 40, ''],
      ['September', 75, ''],
      ['November', 100, ''],
    ],
  },
  {
    prompt: 'Name a noble gas element.',
    answers: [
      ['Helium', 10, 'He'],
      ['Neon', 25, 'Ne'],
      ['Argon', 45, 'Ar'],
      ['Krypton', 65, 'Kr'],
      ['Xenon', 85, 'Xe'],
      ['Radon', 95, 'Rn'],
      ['Oganesson', 100, 'Og'],
    ],
  },
];

function closestCategory(points: number): string {
  return DEFAULT_CATEGORIES.reduce((best, cat) =>
    Math.abs(cat.points - points) < Math.abs(best.points - points) ? cat : best,
  ).id;
}

export const DEMO_PACK: GamePack = {
  format: 'deep-dive',
  version: 2,
  title: 'Below the obvious',
  description:
    'Seven little tests of your big, strange brain. Find the less obvious answer.',
  seconds: 25,
  categories: structuredClone(DEFAULT_CATEGORIES),
  questions: rawQuestions.map((q) => ({
    prompt: q.prompt,
    answers: q.answers.map(([text, pts, aliases]) => ({
      text,
      category: closestCategory(pts),
      aliases: aliases ? aliases.split('|') : [],
    })),
  })),
};
