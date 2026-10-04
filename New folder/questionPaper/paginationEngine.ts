/**
 * questionPaper/paginationEngine.ts
 * ---------------------------------------------------------------------------
 * Measured, deterministic pagination. This replaces the old
 * `Math.ceil(scrollHeight / 1122)` / CSS-only approach, which silently mixed
 * preview coordinates with print coordinates.
 *
 * Three modes, one algorithm:
 *   smart   - pure measured fit (keep-together, orphan avoidance, splitting)
 *   hybrid  - respect the configured per-page question caps, but move a
 *             question that does not fit instead of overflowing
 *   manual  - respect the caps strictly; a question may be split and a
 *             deliberate overflow is reported as a warning
 *
 * The engine is a pure function of (blocks, layout, geometry, measurements), so
 * it is unit-testable in Node and produces identical results in the browser and
 * in the Puppeteer export.
 */

import type { PaperBlock } from './questionBlocks';
import { getPageRule } from './layoutTypes';
import type { PageGeometry, QuestionPaperLayout } from './layoutTypes';
import { renderQuestionBlock } from './questionRenderer';
import type { PaginationDiagnostic } from './diagnostics';

export interface PaginationInput {
  blocks: PaperBlock[];
  layout: QuestionPaperLayout;
  geometry: PageGeometry;
  /** Full height of a block in mm at the page content width. */
  measureBlock(block: PaperBlock): number;
  /** Height of each fragment of a block in mm (used when splitting). */
  measureFragments(block: PaperBlock): number[];
}

export interface PlannedPage {
  pageNumber: number;
  blocks: PaperBlock[];
  usedHeightMm: number;
  availableHeightMm: number;
  freeHeightMm: number;
  questionCount: number;
  overflowMm: number;
  breakReason: string;
}

export interface PaginationResult {
  pages: PlannedPage[];
  diagnostics: PaginationDiagnostic[];
  totalPages: number;
  measured: boolean;
}

const ORPHAN_MIN_FILL_RATIO = 0.9;

const hasContent = (blocks: PaperBlock[]): boolean => blocks.length > 0;

const isQuestion = (block: PaperBlock): boolean => block.kind === 'question';

export function planPages(input: PaginationInput): PaginationResult {
  const { blocks, layout, geometry, measureBlock, measureFragments } = input;
  const diagnostics: PaginationDiagnostic[] = [];
  const available = geometry.contentHeightMm;
  const pages: PlannedPage[] = [];

  let current: PlannedPage = newPage(1, available, 'start');
  pages.push(current);
  let used = 0;
  let previousSpacingAfter = 0;

  const closeCurrent = (reason: string) => {
    current.breakReason = current.breakReason === 'start' ? reason : current.breakReason;
    // Snapshot before switching pages, otherwise usedHeightMm stays 0 and the
    // page diagnostics and the decoration fit check have nothing to work with.
    current.usedHeightMm = used;
    current = newPage(pages.length + 1, available, reason);
    pages.push(current);
    used = 0;
    previousSpacingAfter = 0;
  };

  const ensureCapacity = (block: PaperBlock, heightMm: number, spacingBeforeMm: number): boolean => {
    if (used === 0) return true;
    if (used + spacingBeforeMm + heightMm <= available + 0.05) return true;
    return false;
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const isFirstBlockOnPage = used === 0;
    // The rendered margin-top is max(previous block's spacingAfter, this block's
    // spacingBefore). The planner must use exactly the same rule as the CSS.
    const spacingBefore = isFirstBlockOnPage ? 0 : Math.max(previousSpacingAfter, block.spacingBefore);

    // ---- explicit page break -------------------------------------------
    if (block.breakBefore && hasContent(current.blocks)) {
      closeCurrent(`break-before:${block.id}`);
    }

    // ---- explicit preferred page ---------------------------------------
    if (block.preferredPage && block.preferredPage > current.pageNumber) {
      if (hasContent(current.blocks)) {
        closeCurrent(`preferred-page:${block.preferredPage}`);
      }
      while (current.pageNumber < block.preferredPage) {
        current = newPage(pages.length + 1, available, `reserved-for-preferred-page:${block.preferredPage}`);
        pages.push(current);
        used = 0;
      }
    }

    // ---- per-page question caps (hybrid / manual) ----------------------
    if (isQuestion(block) && layout.mode !== 'smart') {
      const rule = getPageRule(layout, current.pageNumber);
      if (rule?.maxQuestions && current.questionCount >= rule.maxQuestions && hasContent(current.blocks)) {
        closeCurrent(`page-rule:${rule.maxQuestions}`);
      }
    }

    // ---- keep a section header with at least one question ----------------
    if (block.kind === 'section') {
      const nextBlock = blocks.slice(index + 1).find(candidate => candidate.kind === 'question');
      if (nextBlock) {
        const headerHeight = measureBlock(block);
        const nextHeight = measureBlock(nextBlock);
        // The per-page question cap is applied to the *next question*, so a header
        // placed now would be stranded at the bottom of this page. Check the cap
        // before fitting, otherwise the header is already committed.
        const cap = layout.mode === 'smart' ? undefined : getPageRule(layout, current.pageNumber)?.maxQuestions;
        const cappedOut = Boolean(cap) && current.questionCount >= Number(cap);
        // An empty page is never stranded: the next question cannot be pushed off
        // it, so there is nothing to close a page for.
        const roomToClose = hasContent(current.blocks);

        if (headerHeight + Math.max(nextHeight, 12) > available) {
          if (layout.smart.avoidOrphans) {
            diagnostics.push({
              level: 'warning',
              code: 'ORPHAN_SECTION_HEADER',
              message: `Section header for "${block.text.slice(0, 40)}" cannot be followed by a question on the same page.`,
              page: current.pageNumber,
              blockId: block.id,
            });
          }
        } else if (roomToClose && cappedOut) {
          closeCurrent(`section-header-orphan:${block.id}`);
        } else if (roomToClose && layout.smart.avoidOrphans && used + spacingBefore + headerHeight + nextHeight > available + 0.05) {
          closeCurrent(`orphan-avoidance:${block.id}`);
        }
      }
    }

    // ---- fit the block --------------------------------------------------
    const height = measureBlock(block);
    if (ensureCapacity(block, height, spacingBefore)) {
      used += spacingBefore + height;
      pushBlock(current, block);
      previousSpacingAfter = block.spacingAfter;
      continue;
    }

    if (block.allowSplit && block.splittable && block.fragments.length > 1) {
      const fragmentHeights = measureFragments(block);
      const remainingOnPage = available - used - spacingBefore;
      let fitCount = 0;
      let accumulated = 0;
      for (let i = 0; i < fragmentHeights.length; i += 1) {
        if (accumulated + fragmentHeights[i] > remainingOnPage && i > 0) break;
        accumulated += fragmentHeights[i];
        fitCount = i + 1;
      }

      if (fitCount > 0 && fitCount < block.fragments.length) {
        used += spacingBefore + accumulated;
        const headFragments = block.fragments.slice(0, fitCount);
        const tailFragments = block.fragments.slice(fitCount);
        pushBlock(current, { ...block, fragments: headFragments, html: rebuildQuestionHtml(block, headFragments), splittable: false });
        closeCurrent(`split-question:${block.displayNumber ?? block.id}`);
        const continuation: PaperBlock = {
          ...block,
          id: `${block.id}-cont`,
          fragments: tailFragments,
          html: rebuildQuestionHtml(block, tailFragments, true),
          splittable: false,
          breakBefore: false,
          continuationOf: block.id,
          spacingBefore: 0,
        };
        const continuationHeight = measureBlock(continuation);
        pushBlock(current, continuation);
        used += continuationHeight;
        previousSpacingAfter = continuation.spacingAfter;
        if (used > available + 0.05) {
          diagnostics.push({
            level: 'warning',
            code: 'SPLIT_REMAINDER_OVERFLOW',
            message: `The remainder of question ${block.displayNumber} still does not fit on its own page.`,
            page: current.pageNumber,
            blockId: block.id,
            overflowMm: round1(used - available),
          });
        }
        continue;
      }
    }

    closeCurrent(`overflow:${block.id}`);
    const heightOnEmptyPage = measureBlock(block);
    pushBlock(current, block);
    used += heightOnEmptyPage;
    previousSpacingAfter = block.spacingAfter;
    if (used > available + 0.05) {
      const overflowMm = round1(used - available);
      const level = layout.mode === 'manual' && !layout.allowManualOverflow ? 'error' : 'warning';
      diagnostics.push({
        level,
        code: level === 'error' ? 'MANUAL_PAGE_OVERFLOW' : 'BLOCK_OVERFLOW',
        message: `Question ${block.displayNumber ?? block.id} is ${overflowMm} mm taller than the printable area.`,
        page: current.pageNumber,
        blockId: block.id,
        overflowMm,
      });
    }
  }

  // Drop trailing empty pages created by a trailing explicit break.
  current.usedHeightMm = used;
  while (pages.length > 1 && pages[pages.length - 1].blocks.length === 0) {
    pages.pop();
  }

  pages.forEach(page => {
    page.usedHeightMm = round1(page.usedHeightMm);
    page.freeHeightMm = round1(Math.max(0, available - page.usedHeightMm));
    page.overflowMm = round1(Math.max(0, page.usedHeightMm - available));
  });

  if (pages.length === 1 && blocks.length > 0 && available > 0) {
    const fill = pages[0].usedHeightMm / available;
    if (fill < ORPHAN_MIN_FILL_RATIO * 0.4) {
      diagnostics.push({
        level: 'info',
        code: 'PAGE_UNDERFILLED',
        message: `Page 1 uses only ${Math.round(fill * 100)}% of the printable height.`,
        page: 1,
      });
    }
  }

  return {
    pages,
    diagnostics,
    totalPages: pages.length,
    measured: true,
  };
}

function pushBlock(page: PlannedPage, block: PaperBlock): void {
  page.blocks.push(block);
  if (block.kind === 'question') page.questionCount += block.questionSpans;
}

function rebuildQuestionHtml(block: PaperBlock, fragments: PaperBlock['fragments'], continuation = false): string {
  if (!block.sourceItem) return block.html;
  return renderQuestionBlock(block.sourceItem, fragments, continuation);
}

function newPage(pageNumber: number, available: number, reason: string): PlannedPage {
  return {
    pageNumber,
    blocks: [],
    usedHeightMm: 0,
    availableHeightMm: available,
    freeHeightMm: available,
    questionCount: 0,
    overflowMm: 0,
    breakReason: reason,
  };
}

export const round1 = (value: number): number => Math.round(value * 10) / 10;
