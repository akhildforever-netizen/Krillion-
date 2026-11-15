import { DEFAULT_CATEGORIES, TIER_EMOJIS } from '../data/defaults';
import type { Answer, Category, GamePack, RoundResult } from '../types/game';

export const DRAFT_STORAGE_KEY_V2 = 'deep-dive-draft-v2';
export const DRAFT_STORAGE_KEY_V1 = 'deep-dive-draft';

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalize(s: string): string {
  return s.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function oneOff(aRaw: string, bRaw: string): boolean {
  const a = Array.from(aRaw);
  const b = Array.from(bRaw);
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const dif: number[] = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) dif.push(i);
    }
    return (
      dif.length === 1 ||
      (dif.length === 2 &&
        dif[1] === dif[0] + 1 &&
        a[dif[0]] === b[dif[1]] &&
        a[dif[1]] === b[dif[0]])
    );
  }
  const [shorter, longer] = a.length > b.length ? [b, a] : [a, b];
  let i = 0;
  let j = 0;
  let miss = 0;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
    } else {
      miss++;
      j++;
      if (miss > 1) return false;
    }
  }
  return true;
}

interface LegacyAnswer {
  text: string;
  points?: number;
  category?: string;
  aliases?: string[];
}

interface LegacyPack {
  format?: string;
  version?: number;
  title?: unknown;
  description?: unknown;
  seconds?: unknown;
  categories?: Category[];
  questions?: Array<{
    prompt?: unknown;
    answers?: LegacyAnswer[];
  }>;
}

export function migratePack(input: unknown): LegacyPack {
  const raw = input as LegacyPack | null;
  if (!raw || raw.format !== 'deep-dive' || ![1, 2].includes(Number(raw.version))) {
    throw new Error('This is not a supported Krillion / Deep Dive pack.');
  }
  const p = clone(raw);
  if (p.version === 1) {
    p.categories = clone(DEFAULT_CATEGORIES);
    if (!Array.isArray(p.questions)) {
      throw new Error('Questions must be a list.');
    }
    for (const q of p.questions) {
      if (!Array.isArray(q.answers)) {
        throw new Error('Answers must be a list.');
      }
      for (const a of q.answers) {
        if (!Number.isInteger(a.points) || (a.points as number) < 0 || (a.points as number) > 100) {
          throw new Error('Invalid points in the older pack.');
        }
        const pts = a.points as number;
        let cat = p.categories.find((c) => c.points === pts);
        if (!cat) {
          cat = {
            id: `legacy-${pts}`,
            name: `${pts} points`,
            points: pts,
            color: '#9bacc5',
          };
          p.categories.push(cat);
        }
        a.category = cat.id;
        delete a.points;
      }
    }
    p.version = 2;
  }
  return p;
}

export function validatePack(input: unknown): GamePack {
  const p = migratePack(input);
  if (typeof p.title !== 'string' || !p.title.trim() || p.title.length > 120) {
    throw new Error('Add a title (up to 120 characters).');
  }
  if (typeof p.description !== 'string' || p.description.length > 2000) {
    throw new Error('Keep the description under 2,000 characters.');
  }
  if (
    typeof p.seconds !== 'number' ||
    !Number.isInteger(p.seconds) ||
    p.seconds < 5 ||
    p.seconds > 180
  ) {
    throw new Error('Set a whole-number time limit from 5 to 180 seconds.');
  }
  if (!Array.isArray(p.categories) || p.categories.length < 1 || p.categories.length > 50) {
    throw new Error('Include 1–50 scoring categories.');
  }

  const ids = new Set<string>();
  const names = new Set<string>();
  const categories: Category[] = p.categories.map((c) => {
    if (
      typeof c.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(c.id) ||
      ids.has(c.id)
    ) {
      throw new Error('Category IDs must be unique.');
    }
    if (
      typeof c.name !== 'string' ||
      !c.name.trim() ||
      c.name.length > 60 ||
      names.has(normalize(c.name))
    ) {
      throw new Error('Give each category a unique name, up to 60 characters.');
    }
    if (
      typeof c.points !== 'number' ||
      !Number.isInteger(c.points) ||
      c.points < 0 ||
      c.points > 10000
    ) {
      throw new Error('Category points must be whole numbers from 0 to 10,000.');
    }
    ids.add(c.id);
    names.add(normalize(c.name));
    return {
      id: c.id,
      name: c.name.trim(),
      points: c.points,
      color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#8dc8e5',
    };
  });

  if (!Array.isArray(p.questions) || p.questions.length < 1 || p.questions.length > 100) {
    throw new Error('Include 1–100 questions.');
  }

  const questions = p.questions.map((q, i) => {
    if (typeof q.prompt !== 'string' || !q.prompt.trim() || q.prompt.length > 500) {
      throw new Error(`Question ${i + 1}: add a prompt under 500 characters.`);
    }
    if (!Array.isArray(q.answers) || q.answers.length < 1 || q.answers.length > 1000) {
      throw new Error(`Question ${i + 1}: include 1–1,000 answers.`);
    }
    const seen = new Set<string>();
    const answers: Answer[] = q.answers.map((a) => {
      if (typeof a.text !== 'string' || !a.text.trim() || a.text.length > 150) {
        throw new Error(`Question ${i + 1}: each answer needs a name under 150 characters.`);
      }
      if (typeof a.category !== 'string' || !ids.has(a.category)) {
        throw new Error(`Question ${i + 1}: choose a category for every answer.`);
      }
      if (
        !Array.isArray(a.aliases) ||
        a.aliases.length > 30 ||
        a.aliases.some((s) => typeof s !== 'string' || !s.trim() || s.length > 150)
      ) {
        throw new Error(`Question ${i + 1}: invalid alternate spellings.`);
      }
      const forms = new Set([a.text, ...a.aliases].map(normalize));
      for (const s of forms) {
        if (seen.has(s)) {
          throw new Error(`Question ${i + 1}: “${s}” belongs to more than one answer.`);
        }
        seen.add(s);
      }
      return {
        text: a.text.trim(),
        category: a.category,
        aliases: a.aliases.map((s) => s.trim()),
      };
    });
    return {
      prompt: q.prompt.trim(),
      answers,
    };
  });

  return {
    format: 'deep-dive',
    version: 2,
    title: p.title.trim(),
    description: p.description,
    seconds: p.seconds,
    categories,
    questions,
  };
}

export function categoryById(id: string | null, pack: GamePack): Category | undefined {
  if (!id) return undefined;
  return pack.categories.find((c) => c.id === id);
}

export function pointsOf(answer: Answer, pack: GamePack): number {
  return categoryById(answer.category, pack)?.points ?? 0;
}

export function emojiForCategory(cat: Category | undefined, maxPoints: number): string {
  if (!cat) return '🌊';
  if (TIER_EMOJIS[cat.id]) return TIER_EMOJIS[cat.id];
  const ratio = maxPoints > 0 ? cat.points / maxPoints : 0;
  if (ratio >= 0.9) return '🌟';
  if (ratio >= 0.7) return '🏮';
  if (ratio >= 0.5) return '🦑';
  if (ratio >= 0.25) return '🐟';
  if (ratio >= 0.12) return '🤡';
  return '🫧';
}

export function slugifyTitle(title: string): string {
  return (
    title
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'krillion-custom-dive'
  );
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function buildPortableHtml(pack: GamePack): Promise<string> {
  const res = await fetch('/assets/aistudio/Deep-Dive_ed44b8ae.html');
  if (!res.ok) {
    throw new Error('Could not load standalone offline template.');
  }
  const template = await res.text();
  const safePack = JSON.stringify(pack).replace(/</g, '\\u003c');
  return template
    .replace(
      /(<script id="embedded-pack" type="application\/json">)[\s\S]*?(<\/script>)/,
      (_, open: string, close: string) => `${open}${safePack}${close}`,
    )
    .replace('<title>Deep Dive • Custom descent</title>', `<title>KRILLION • ${pack.title.replace(/</g, '&lt;')}</title>`)
    .replace('<div class="brand">DEEP<span> DIVE</span></div>', '<div class="brand">KRIL<span>LION</span></div>')
    .replace('<h1>DEEP DIVE</h1><div class="subtitle">THE CUSTOM DESCENT</div>', '<h1>KRILLION</h1><div class="subtitle">THE REVERSE TRIVIA GAME</div>');
}

export function buildShareSummary(
  pack: GamePack,
  results: RoundResult[],
  totalPoints: number,
  maxPoints: number,
): string {
  const maxCatPoints = Math.max(1, ...pack.categories.map((c) => c.points));
  const emojiRow = results
    .map((r) => emojiForCategory(categoryById(r.category, pack), maxCatPoints))
    .join('');

  const lines = results.map((r, i) => {
    const cat = categoryById(r.category, pack);
    const emoji = emojiForCategory(cat, maxCatPoints);
    return `${i + 1}. ${emoji} ${(r.points * 10).toLocaleString()}m${cat ? ` · ${cat.name}` : ' · Surfaced'}`;
  });

  return [
    `KRILLION — ${pack.title}`,
    `${(totalPoints * 10).toLocaleString()}m · ${totalPoints.toLocaleString()}/${maxPoints.toLocaleString()} pts`,
    emojiRow,
    ...lines,
  ].join('\n');
}
