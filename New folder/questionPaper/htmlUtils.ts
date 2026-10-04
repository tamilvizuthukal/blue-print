/**
 * questionPaper/htmlUtils.ts
 * ---------------------------------------------------------------------------
 * Tiny, dependency-free helpers shared by the question paper renderer and the
 * block builder. Kept separate so both the browser bundle and the Node/Puppeteer
 * bundle can use them without a DOM.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, char => HTML_ESCAPES[char]);
}

export function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}

/** Collapses &nbsp; noise and trims, without touching other markup. */
export function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/(&nbsp;| )+/gi, ' ').replace(/[ \t]{2,}/g, ' ').trim();
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

const ROMAN_NUMERALS: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(value: number): string {
  if (!Number.isFinite(value) || value < 1) return String(value);
  let remaining = Math.floor(value);
  let out = '';
  ROMAN_NUMERALS.forEach(([amount, numeral]) => {
    while (remaining >= amount) {
      out += numeral;
      remaining -= amount;
    }
  });
  return out;
}

/** "1", "2.5" -> "2½" (used for the marks row, matching the reference paper). */
export function formatMark(marks: number): string {
  if (!Number.isFinite(marks)) return '0';
  const value = Number(marks.toFixed(2));
  if (Math.abs(value - Math.round(value)) < 0.001) return String(Math.round(value));
  const whole = Math.floor(value);
  const fraction = Math.round((value - whole) * 10);
  if (fraction === 5) return `${whole === 0 ? '' : whole}½`;
  return String(value);
}

export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => deepClone(item)) as unknown as T;
  const out: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    out[key] = deepClone(item);
  });
  return out as T;
}
