import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyMixedFonts,
  parseMcqFromHtml,
  shouldStackMcqOptions,
  sliceBalancedTokens,
} from '../questionRenderer';
import { auditFontsInHtml, buildFontFaceCss, FONT_FACE_SOURCES } from '../typography';

const strip = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

test('every declared face is explicit about its weight and file', () => {
  const css = buildFontFaceCss({ origin: 'https://example.test' });
  assert.equal(css.match(/@font-face/g)?.length, FONT_FACE_SOURCES.length);
  assert.match(css, /font-family: 'TAU-Paalai';/);
  assert.match(css, /font-family: 'TAU-Urai';/);
  assert.match(css, /font-weight: 400;/);
  assert.match(css, /font-weight: 700;/);
  assert.match(css, /TAU-Paalai%20Bold\.ttf/);
  assert.match(css, /TAU-Urai%20Bold\.ttf/);
  assert.equal(auditFontsInHtml(css).valid, true);
});

test('the font audit rejects weight-suffixed family names', () => {
  const bad = `<div style="font-family: 'TAU-Paalai Bold', serif;">உரை</div>`;
  const result = auditFontsInHtml(bad);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].reason, 'forbidden-alias');
  assert.equal(result.issues[0].family, 'TAU-Paalai Bold');
});

test('the font audit rejects unknown families', () => {
  const result = auditFontsInHtml(`<div style="font-family: 'Noto Sans', sans-serif;">x</div>`);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].reason, 'not-allowed');
});

test('bold Tamil is expressed with font-weight, never with a family name', () => {
  const html = `<span class="qp-tamil-bold" style="font-weight:700">சமக்ர சிக்ஷா கேரளம்</span>`;
  assert.equal(auditFontsInHtml(html).valid, true);
});

test('Latin runs are wrapped once and the transform is idempotent', () => {
  const once = applyMixedFonts('<p>தமிழ் English 2026 உரை</p>');
  assert.equal(once.match(/qp-english/g)?.length, 2);
  const twice = applyMixedFonts(once);
  assert.equal(twice, once, 'a second pass must not create nested spans');
});

test('MCQ options are extracted from rich text without a DOM', () => {
  const html =
    '<p>இலங்கை தமிழ் பாடத்தின் முதல் பாடம் எது?</p><p>அ) கலைமாமுரை</p><p>ஆ) கம்பளி</p><p>இ) சுவையொன்று</p><p>ஈ) பார்த்திப்பூ</p>';
  const parsed = parseMcqFromHtml(html);
  assert.ok(parsed);
  assert.equal(strip(parsed.stem), 'இலங்கை தமிழ் பாடத்தின் முதல் பாடம் எது?');
  assert.deepEqual(parsed.options.map(strip), ['கலைமாமுரை', 'கம்பளி', 'சுவையொன்று', 'பார்த்திப்பூ']);
  assert.deepEqual(parsed.markers, ['அ)', 'ஆ)', 'இ)', 'ஈ)']);
});

test('MCQ parsing works when the text is wrapped in inline formatting', () => {
  const html =
    '<div><span>ஒரு வினா</span> <b>அ)</b> முதல் <i>ஆ)</i> இரண்டாவது <u>இ)</u> மூன்றாவது ஈ) நான்காவது</div>';
  const parsed = parseMcqFromHtml(html);
  assert.ok(parsed);
  assert.deepEqual(parsed.options.map(strip), ['முதல்', 'இரண்டாவது', 'மூன்றாவது', 'நான்காவது']);
});

test('a text without four options is left untouched', () => {
  const parsed = parseMcqFromHtml('<p>எளிய வினை</p>');
  assert.equal(parsed, null);
});

test('sliceBalancedTokens never emits orphan closing tags', () => {
  const tokens = ['<p>', 'உரை', '</p>'];
  const sliced = sliceBalancedTokens(tokens, 0, 2);
  assert.equal(sliced.includes('</p>'), false);
  assert.match(sliced, /உரை/);
});

test('the MCQ layout switches to stacked options when a column is too narrow', () => {
  assert.equal(shouldStackMcqOptions(['சுருக்கமான விடை', 'குறுகிய விடை'], 100, 160), true);
  assert.equal(shouldStackMcqOptions(['ஆ', 'இ'], 10, 160), false);
});
