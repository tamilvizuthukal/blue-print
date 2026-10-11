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

/**
 * HTML entity decode for strings lifted out of HTML (attribute values, tag
 * bodies). The audit and the style sanitizer scan generated HTML, so they see
 * `&quot;`/`&#39;` where the DOM writer stored a quote.
 */
export function decodeEntities(value: string): string {
  if (!value) return '';
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;|&#x0*27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

const STYLE_ATTRIBUTE = /\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi;
const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const FONT_FAMILY_DECL = /font-family\s*:\s*([^;{}]+)/gi;

function encodeAttrEntities(value: string, quote: '"' | "'"): string {
  let out = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (quote === '"') out = out.replace(/"/g, '&quot;');
  else out = out.replace(/'/g, '&#39;');
  return out;
}

/**
 * Removes inline `font-family` declarations from `style` attributes.
 *
 * Typography is controlled by the paper stylesheet; rich-text content that
 * carries its own font faces must never silently override it (and must never
 * fail the font audit). Other inline styles (`font-weight`, `color`, ...) are
 * preserved. DOM-free so the browser and the Puppeteer export stay identical.
 */
function stripFontFamilyFromCss(css: string): string {
  return String(css).replace(FONT_FAMILY_DECL, '');
}

export function stripInlineFontFamily(html: string): string {
  if (!html || (!/style\s*=/i.test(html) && !/<style\b/i.test(html))) return html;
  return html
    .replace(STYLE_ATTRIBUTE, (full, _quoted, doubleValue, singleValue) => {
      const quote: '"' | "'" = doubleValue !== undefined ? '"' : "'";
      const body = (doubleValue !== undefined ? doubleValue : singleValue) as string;
      const cleaned = decodeEntities(body)
        .split(';')
        .map(part => part.trim())
        .filter(part => part && !/^font-family\s*:/i.test(part))
        .join(';');
      if (!cleaned) return '';
      return ` style=${quote}${encodeAttrEntities(cleaned, quote)}${quote}`;
    })
    .replace(STYLE_BLOCK, (block, css) => {
      const cleaned = stripFontFamilyFromCss(css);
      return cleaned === css ? block : `<style>${cleaned}</style>`;
    });
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
