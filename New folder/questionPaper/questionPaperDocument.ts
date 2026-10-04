/**
 * questionPaper/questionPaperDocument.ts
 * ---------------------------------------------------------------------------
 * The single entry point of the new paper pipeline.
 *
 *   buildQuestionPaperDocument({ blueprint, paperType, layout, measurer })
 *     -> sequence (canonical numbering)
 *     -> blocks    (semantic, measurable)
 *     -> pages     (measured pagination)
 *     -> html      (screen preview == print == PDF)
 *
 * Pass a real `BlockMeasurer` (see `domMeasurer.ts`) for authoritative output.
 * Without one the document is built with a text-based estimator and is flagged
 * as `estimated`, which the UI and the export endpoint surface as a warning.
 */

import type { Blueprint, QuestionPaperType } from '../types';
import { buildPaperBlocks } from './questionBlocks';
import type { BlockMeasurer, PaperBlock } from './questionBlocks';
import { buildQuestionPaperDiagnostics } from './diagnostics';
import type { QuestionPaperDiagnostics } from './diagnostics';
import { buildIdentity, renderFooter, renderRunningHeader, ptToMm } from './questionRenderer';
import { escapeHtml } from './htmlUtils';
import { buildQuestionSequence } from './questionSequence';
import type { QuestionSequence } from './questionSequence';
import { planPages } from './paginationEngine';
import type { PlannedPage } from './paginationEngine';
import {
  buildFontFaceCss,
  assertFontsAuditable,
} from './typography';
import { buildPrintPageRuleCss, buildQuestionPaperCss } from './questionPaperStyles';
import {
  normalizeQuestionPaperLayout,
  resolvePageGeometry,
} from './layoutTypes';
import type { PageGeometry, QuestionPaperLayout } from './layoutTypes';

export interface BuildQuestionPaperOptions {
  blueprint: Partial<Blueprint>;
  paperType?: QuestionPaperType | null;
  /** Raw (possibly legacy) or already normalized layout. */
  layout?: unknown;
  notes?: string[];
  measurer?: BlockMeasurer;
  /** @font-face CSS; when omitted it is generated for `/fonts`. */
  fontCss?: string;
  fontOrigin?: string;
  fontDataUris?: Record<string, string>;
  screenPreview?: boolean;
  previewZoom?: number;
  /** Standalone document (used for the PDF export). */
  standalone?: boolean;
  /** Verified font readiness, reported in the diagnostics. */
  fontReadiness?: { ready: boolean; missing: string[] } | null;
}

export interface QuestionPaperDocument {
  layout: QuestionPaperLayout;
  geometry: PageGeometry;
  sequence: QuestionSequence;
  blocks: PaperBlock[];
  pages: PlannedPage[];
  totalPages: number;
  css: string;
  fontCss: string;
  html: string;
  estimated: boolean;
  paperCode: string;
  setLabel: string;
  title: string;
  diagnostics: QuestionPaperDiagnostics;
}

const TAMIL_CHARS_PER_MM = 0.34;

/** Fallback estimator. Never used for the final PDF when a DOM is available. */
export function createEstimatedMeasurer(layout: QuestionPaperLayout, geometry: PageGeometry): BlockMeasurer {
  const lineHeightMm = ptToMm(layout.typography.bodyFontSize) * layout.typography.bodyLineHeight;
  const widthMm = geometry.contentWidthMm;

  const estimateText = (text: string): number => {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return lineHeightMm;
    const charsPerLine = Math.max(8, Math.floor(widthMm / (ptToMm(layout.typography.bodyFontSize) * TAMIL_CHARS_PER_MM)));
    const lines = Math.max(1, Math.ceil(clean.length / charsPerLine));
    return lines * lineHeightMm;
  };

  return {
    measureFragment: fragment => {
      if (fragment.key === 'mcq') {
        const items = (fragment.text.match(/அ\)|ஆ\)|இ\)|ஈ\)/g) || []).length || 4;
        const perOption = Math.ceil(items / 2);
        return Math.max(lineHeightMm, perOption * lineHeightMm * 1.4);
      }
      if (fragment.key === 'choice-or' || fragment.key === 'time') return lineHeightMm;
      return estimateText(fragment.text) + lineHeightMm * 0.2;
    },
    measureTextMm: text => (text || '').length * ptToMm(layout.typography.bodyFontSize) * 0.5,
  };
}

export function buildQuestionPaperDocument(options: BuildQuestionPaperOptions): QuestionPaperDocument {
  const { blueprint, paperType, notes, screenPreview = false, previewZoom = 1, standalone = false } = options;

  const rawItems = Array.isArray(blueprint?.items) ? blueprint!.items : [];
  const estimatedTotal = rawItems.reduce(
    (sum, item) => sum + Math.max(1, Number((item as any)?.questionCount) || 1),
    0
  );
  const layout = normalizeQuestionPaperLayout(options.layout, { totalQuestions: estimatedTotal });
  const geometry = resolvePageGeometry(layout);
  const sequence = buildQuestionSequence(blueprint, paperType);
  const identity = buildIdentity(blueprint);

  const measurer = options.measurer || createEstimatedMeasurer(layout, geometry);
  const estimated = !options.measurer;

  const blocks = buildPaperBlocks({ blueprint, paperType, layout, sequence, notes, measurer });

  const blockHeightCache = new Map<string, number>();
  const fragmentHeightCache = new Map<string, number[]>();
  const blockKey = (block: PaperBlock): string => `${block.id}:${block.fragments.length}:${block.text.length}`;

  const measureBlock = (block: PaperBlock): number => {
    const key = blockKey(block);
    const cached = blockHeightCache.get(key);
    if (cached !== undefined) return cached;
    let height: number;
    if (block.fragments.length === 0) {
      height = options.measurer
        ? options.measurer.measureFragment(
            { key: `${block.id}-raw`, html: block.html, text: block.text, splittable: false },
            { contentWidthMm: geometry.contentWidthMm, block }
          )
        : lineEstimate(block.text, geometry.contentWidthMm, layout);
    } else {
      height = block.fragments.reduce(
        (sum, fragment) =>
          sum + measurer.measureFragment(fragment, { contentWidthMm: geometry.contentWidthMm, block }),
        0
      );
    }
    blockHeightCache.set(key, height);
    return height;
  };

  const measureFragments = (block: PaperBlock): number[] => {
    const key = blockKey(block);
    const cached = fragmentHeightCache.get(key);
    if (cached) return cached;
    const heights = block.fragments.map(fragment =>
      measurer.measureFragment(fragment, { contentWidthMm: geometry.contentWidthMm, block })
    );
    fragmentHeightCache.set(key, heights);
    return heights;
  };

  const pagination = planPages({ blocks, layout, geometry, measureBlock, measureFragments });
  const pages = mergeDecorationTail(pagination.pages, measureBlock);

  const totalPages = pages.length;
  const css = buildQuestionPaperCss(layout, geometry, { screenPreview, previewZoom });
  const fontCss = options.fontCss || buildFontFaceCss({ origin: options.fontOrigin, dataUris: options.fontDataUris });

  const html = renderDocumentHtml({
    pages,
    totalPages,
    layout,
    geometry,
    css,
    fontCss,
    paperCode: identity.paperCode,
    setLabel: identity.setLabel,
    title: identity.title,
    screenPreview,
    previewZoom,
    standalone,
  });

  assertFontsAuditable(html, 'question paper document');

  const diagnostics = buildQuestionPaperDiagnostics({
    sequenceWarnings: sequence.warnings,
    paginationDiagnostics: pagination.diagnostics,
    pages,
    html,
    fontReadiness: options.fontReadiness ?? null,
  });

  if (estimated) {
    diagnostics.pagination.push({
      level: 'warning',
      code: 'ESTIMATED_LAYOUT',
      message: 'No DOM measurer was provided; block heights were estimated from text length instead of measured.',
    });
    if (diagnostics.level === 'info') diagnostics.level = 'warning';
    diagnostics.summary = `${pages.length} page(s) (estimated), ${diagnostics.pagination.length} pagination note(s)`;
  }

  return {
    layout,
    geometry,
    sequence,
    blocks,
    pages,
    totalPages,
    css,
    fontCss,
    html,
    estimated,
    paperCode: identity.paperCode,
    setLabel: identity.setLabel,
    title: identity.title,
    diagnostics,
  };
}

function lineEstimate(text: string, widthMm: number, layout: QuestionPaperLayout): number {
  const lineHeightMm = ptToMm(layout.typography.bodyFontSize) * layout.typography.bodyLineHeight;
  const charsPerLine = Math.max(
    8,
    Math.floor(widthMm / (ptToMm(layout.typography.bodyFontSize) * TAMIL_CHARS_PER_MM))
  );
  const lines = Math.max(1, Math.ceil((text || '').replace(/\s+/g, ' ').trim().length / charsPerLine));
  return lines * lineHeightMm;
}

/**
 * The closing decoration belongs to the end of the paper, not to a page of its
 * own. When the planner pushed it onto a fresh page it is moved back.
 */
function mergeDecorationTail(pages: PlannedPage[], measureBlock: (block: PaperBlock) => number): PlannedPage[] {
  const result = pages.map(page => ({ ...page, blocks: [...page.blocks] }));
  const lastIndex = result.length - 1;
  if (lastIndex < 1) return result;
  const lastPage = result[lastIndex];
  if (lastPage.blocks.length !== 1) return result;
  const decoration = lastPage.blocks[0];
  if (decoration.kind !== 'decoration') return result;

  const previous = result[lastIndex - 1];
  const decorationHeight = measureBlock(decoration);
  const available = previous.availableHeightMm;
  const lastBlock = previous.blocks[previous.blocks.length - 1];
  const spacing = lastBlock ? Math.max(lastBlock.spacingAfter, decoration.spacingBefore) : 0;
  if (previous.usedHeightMm + spacing + decorationHeight <= available + 0.05) {
    previous.blocks.push(decoration);
    previous.usedHeightMm = Math.round((previous.usedHeightMm + spacing + decorationHeight) * 10) / 10;
    result.pop();
  }
  return result;
}

interface RenderDocumentHtmlInput {
  pages: PlannedPage[];
  totalPages: number;
  layout: QuestionPaperLayout;
  geometry: PageGeometry;
  css: string;
  fontCss: string;
  paperCode: string;
  setLabel: string;
  title: string;
  screenPreview: boolean;
  previewZoom: number;
  standalone: boolean;
}

export function renderDocumentHtml(input: RenderDocumentHtmlInput): string {
  const {
    pages,
    totalPages,
    layout,
    geometry,
    css,
    fontCss,
    paperCode,
    setLabel,
    title,
    screenPreview,
    previewZoom,
    standalone,
  } = input;

  const pageHtml = pages
    .map(page => {
      let previousSpacingAfter = 0;
      const bodyHtml = page.blocks
        .map((block, blockIndex) => {
          const spacing = blockIndex === 0 ? 0 : Math.max(previousSpacingAfter, block.spacingBefore);
          previousSpacingAfter = block.spacingAfter;
          const style = spacing > 0 ? ` style="margin-top:${spacing}mm"` : '';
          return `<div class="qp-block-slot"${style}>${block.html}</div>`;
        })
        .join('\n');

      const runningHeaderHtml =
        layout.runningHeader && page.pageNumber > 1
          ? renderRunningHeader(page.pageNumber, totalPages, paperCode, title)
          : '';

      const footerHtml = renderFooter({
        pageNumber: page.pageNumber,
        totalPages,
        paperCode,
        setLabel,
        layout,
      });

      const overflowClass = page.overflowMm > 0 ? ' qp-page--overflow' : '';

      return `
  <section class="qp-page${overflowClass}" data-page="${page.pageNumber}" data-questions="${page.questionCount}">
    <div class="qp-page__body">
      ${runningHeaderHtml}
      ${bodyHtml}
    </div>
    <div class="qp-page__footer">${footerHtml}</div>
  </section>`;
    })
    .join('\n');

  const rootClass = ['qp-root', screenPreview ? 'qp-root--screen' : '', screenPreview && previewZoom !== 1 ? 'qp-root--screen-zoom' : '']
    .filter(Boolean)
    .join(' ');

  const inner = `
<style>
${fontCss}
</style>
<style>
${buildPrintPageRuleCss({ isolate: !standalone })}
${css}
</style>
<div class="${rootClass}">
${pageHtml}
</div>`;

  if (!standalone) return inner;

  return `<!DOCTYPE html>
<html lang="ta">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(`${setLabel} ${paperCode}`)}</title>
</head>
<body style="margin:0;padding:0;background:#fff;">
${inner}
</body>
</html>`;
}
