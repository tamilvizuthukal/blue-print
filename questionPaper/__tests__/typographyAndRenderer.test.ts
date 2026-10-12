import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyMixedFonts,
  parseMcqFromHtml,
  shouldStackMcqOptions,
  sliceBalancedTokens,
  renderStructuredQuestion,
  buildQuestionFragments,
  renderSectionBlock,
} from '../questionRenderer';
import { auditFontsInHtml, buildFontFaceCss, FONT_FACE_SOURCES } from '../typography';
import { stripInlineFontFamily } from '../htmlUtils';
import { buildQuestionPaperDocument } from '../questionPaperDocument';

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

test('the font audit decodes HTML-escaped quotes before parsing families (regression for the &quot crash)', () => {
  const html = `<div style="font-family:&quot;Times New Roman&quot;, serif;">உரை</div>`;
  const result = auditFontsInHtml(html);
  assert.equal(result.valid, true);
});

test('the font audit still flags forbidden aliases when they are HTML-escaped', () => {
  const html = `<div style="font-family:&#39;TAU-Paalai Bold&#39;, serif;">உரை</div>`;
  const result = auditFontsInHtml(html);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].reason, 'forbidden-alias');
  assert.equal(result.issues[0].family, 'TAU-Paalai Bold');
});

test('stripInlineFontFamily removes inline font-family but keeps other styles', () => {
  const html = `<span style="font-family:&quot;Times New Roman&quot;;color:#333">உரை</span>`;
  assert.equal(stripInlineFontFamily(html), `<span style="color:#333">உரை</span>`);
  assert.equal(stripInlineFontFamily(`<span style="font-family:x">உரை</span>`), `<span>உரை</span>`);
  assert.equal(stripInlineFontFamily('<span>உரை</span>'), '<span>உரை</span>');
});

test('stripInlineFontFamily neutralizes font-family inside <style> blocks (e.g. LibreOffice pastes)', () => {
  const html = `<style>p.MsoNormal{font-family:"Liberation Serif";font-size:12pt} h1{font-family: Liberation Serif;margin:0}</style><p>Coca Cola</p>`;
  const out = stripInlineFontFamily(html);
  assert.doesNotMatch(out, /font-family/i);
  assert.match(out, /font-size:12pt/);
  assert.match(out, /margin:0/);
});

test('a question whose content carries a pasted style sheet still passes the font audit', () => {
  const html = `<style type="text/css">p{font-family:"Liberation Serif"} li{font-family:'Liberation Serif',serif}</style><p>உரை English 2026</p>`;
  const result = auditFontsInHtml(stripInlineFontFamily(html));
  assert.equal(result.valid, true);
});

test('the font audit ignores "font-family:" that is author text, not CSS', () => {
  const html = `<p>உரை font-family: Liberation Serif என்பது உரை <b>2026</b></p>`;
  const result = auditFontsInHtml(html);
  assert.equal(result.valid, true);
});

test('a genuine inline font-family that survives sanitizing is still flagged', () => {
  const result = auditFontsInHtml(`<p style="font-family: &quot;Liberation Serif&quot;">உரை</p>`);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].family, 'Liberation Serif');
  assert.equal(result.issues[0].reason, 'not-allowed');
});

test('a pasted rich-text question builds a whole paper with a clean font audit', () => {
  const paste = `<style type="text/css">p.MsoNormal{font-family:"Liberation Serif";margin:0}</style><p><b>Coca Cola</b> வினா? font-family: Liberation Serif</p>`;
  const doc = buildQuestionPaperDocument({
    blueprint: { items: [{ id: 'q1', sectionId: 's1', questionText: paste, marksPerQuestion: 2, questionCount: 1 }] } as any,
  });
  assert.equal(auditFontsInHtml(doc.html).valid, true);
});

test('applyMixedFonts strips inline font-family before wrapping Latin runs', () => {
  const out = applyMixedFonts(`<p style="font-family:&quot;Times New Roman&quot;;margin:0">Coca Cola உரை</p>`);
  assert.doesNotMatch(out, /font-family/i);
  assert.match(out, /qp-english/);
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

test('match-pairs renderer keeps two columns and never exposes answer mappings', () => {
  const html = renderStructuredQuestion({ type: 'match_pairs', matchPairs: {
    prompt: 'விடைகளை இணைக்கவும்',
    leftTitle: 'பெயர்கள்', rightTitle: 'படைப்புகள்',
    leftItems: [{ id: 'l1', text: 'நீண்ட தமிழ் உருப்பு' }], rightItems: [{ id: 'r1', text: 'நூல்' }],
    answerMappings: [{ leftId: 'l1', rightId: 'r1' }],
  } });
  assert.match(html, /qp-structured-match__column/);
  assert.doesNotMatch(html, /ஏற்றபடி இணைத்து எழுதுக/);
  assert.match(html, /விடைகளை இணைக்கவும்/);
  assert.ok(html.indexOf('விடைகளை இணைக்கவும்') < html.indexOf('qp-structured-match'));
  assert.doesNotMatch(html, /இடப்பக்கம்|வலப்பக்கம்/);
  assert.match(html, /நீண்ட தமிழ் உருப்பு/);
  assert.doesNotMatch(html, /answerMappings|leftId|rightId/);
});

test('profile table escapes user content and keeps value as a separate wrapped cell', () => {
  const html = renderStructuredQuestion({ type: 'profile_table', profileTable: {
    prompt: 'வினாவைச் சரியாக விடையளி', bordered: true, rows: [{ id: 'r1', label: '<பெயர்>', value: 'பலவரி\nஉள்ளடக்கம்' }],
  } });
  assert.match(html, /qp-structured-profile/);
  assert.match(html, /வினாவைச் சரியாக விடையளி/);
  assert.match(html, /&lt;பெயர்&gt;/);
  assert.ok(html.indexOf('வினாவைச் சரியாக விடையளி') < html.indexOf('qp-structured-profile'));
  assert.match(html, /பலவரி<br>உள்ளடக்கம்/);
  assert.doesNotMatch(html, /<பெயர்>/);
});

test('word-sun renderer builds vector connections and escapes Tamil node text', () => {
  const html = renderStructuredQuestion({ type: 'word_sun', wordSun: {
    prompt: 'சுற்றியுள்ள சொற்களை எழுதுக',
    centerText: 'மையச் சொல்', nodes: [
      { id: 'n1', position: 0, text: 'நீண்ட சொல் & ஒன்று' },
      { id: 'n2', position: 1, text: 'இரண்டாம் சொல்' },
    ],
  } });
  assert.match(html, /<svg/);
  assert.equal(html.match(/<line /g)?.length, 2);
  assert.match(html, /மையச் சொல்/);
  assert.match(html, /சொற்சூரியனைப் பூர்த்தி செய்க./);
  assert.match(html, /சுற்றியுள்ள சொற்களை எழுதுக/);
  assert.ok(html.indexOf('சுற்றியுள்ள சொற்களை எழுதுக') < html.indexOf('<svg'));
  assert.doesNotMatch(html, /<strong>சொற்சூரியன்/);
  assert.match(html, /&amp;/);
  assert.match(html.replace(/<\/?tspan[^>]*>/g, ' '), /நீண்ட\s+சொல்\s+&amp;\s+ஒன்று/);
});

test('section heading removes a range repeated at the start of its instruction', () => {
  const html = renderSectionBlock({
    roman: 'I', rangeLabel: '1 முதல் 4 வரையுள்ள',
    instruction: '1 முதல் 4 வரையுள்ள அனைத்து வினாக்களுக்கும் சரியான விடையைத் தேர்ந்தெடுத்து எழுதுக.',
    marks: 1, declaredMarksTotal: 4, declaredCount: 4, isUnmatched: false,
  } as any);
  const text = strip(html);
  assert.equal((text.match(/1 முதல் 4 வரையுள்ள/g) || []).length, 1);
  assert.match(text, /அனைத்து வினாக்களுக்கும் சரியான விடையைத் தேர்ந்தெடுத்து எழுதுக/);
});

test('internal choice renders its alternatives once without a duplicated stem', () => {
  const fragments = buildQuestionFragments({
    item: { questionText: 'முதல் தேர்வு உரை', questionTextB: 'இரண்டாம் தேர்வு உரை' },
    hasInternalChoice: true,
  } as any, { bodyWidthMm: 170 });
  const html = fragments.map(fragment => fragment.html).join('');
  assert.equal((html.match(/முதல் தேர்வு உரை/g) || []).length, 1);
  assert.equal((html.match(/இரண்டாம் தேர்வு உரை/g) || []).length, 1);
  assert.doesNotMatch(html, /qp-q__stem/);
});

test('question timing metadata is never rendered in the paper', () => {
  const fragments = buildQuestionFragments({
    item: { questionText: '<p>வினா</p>', time: 2 },
    hasInternalChoice: false,
  } as any, { bodyWidthMm: 170 });
  assert.doesNotMatch(fragments.map(fragment => fragment.html).join(''), /நேரம்|நிமிடம்|qp-q__time/);
});

const janakiQuestion = () =>
  '<p>கீழ்க்கண்ட வினாக்களுக்கு விடையளி.</p>' +
  '<p>அ) எஸ். ஜானகி அவர்கள் எந்த மாநிலத்தில் ,எந்த ஊரில் பிறந்தார்?</p>' +
  '<p>ஆ) இவர் எத்தனை மொழிகளில் பாடியுள்ளார்?</p>' +
  '<p>இ) இவருடைய குரு யார்?</p>' +
  '<p>ஈ) தமிழ்நாடு அரசு இவருக்கு எந்த விருது வழங்கிய சிறப்பித்தது?</p>';

test('MCQ-style அ)/ஆ)/இ)/ஈ) above question 8 renders as authored, not as an option grid', () => {
  const fragments = buildQuestionFragments({
    displayNumber: 9,
    item: { questionText: janakiQuestion() },
    hasInternalChoice: false,
  } as any, { bodyWidthMm: 170 });
  const html = fragments.map(fragment => fragment.html).join('');
  assert.doesNotMatch(html, /qp-mcq/);
  assert.match(html, /எஸ். ஜானகி அவர்கள்/);
  assert.match(html, /தமிழ்நாடு அரசு இவருக்கு எந்த விருது/);
});

test('the MCQ option layout is still applied at question 8 and below', () => {
  const fragments = buildQuestionFragments({
    displayNumber: 8,
    item: { questionText: janakiQuestion() },
    hasInternalChoice: false,
  } as any, { bodyWidthMm: 170 });
  const html = fragments.map(fragment => fragment.html).join('');
  assert.match(html, /qp-mcq--stacked qp-mcq--indented/);
});
