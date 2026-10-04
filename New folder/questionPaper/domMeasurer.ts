/**
 * questionPaper/domMeasurer.ts
 * ---------------------------------------------------------------------------
 * Real measurement against a live DOM. This is the only authoritative source of
 * block heights: the browser preview and the Puppeteer export both call it after
 * `awaitFontsReady()`, so a missing Tamil face can never change the pagination.
 *
 * The measurement host is never zoomed/scaled, otherwise `getBoundingClientRect`
 * would return scaled pixels and the pagination would be wrong.
 */

import type { BlockMeasurer, PaperBlock } from './questionBlocks';
import type { QuestionFragment } from './questionRenderer';
import { buildQuestionPaperCss } from './questionPaperStyles';
import { mmToPx, pxToMm } from './questionRenderer';
import type { PageGeometry, QuestionPaperLayout } from './layoutTypes';
import { awaitFontsReady, verifyFontsLoaded } from './typography';

const HOST_ID = 'qp-measure-host';

export interface DomMeasurerHandle {
  measurer: BlockMeasurer;
  fontsReady: boolean;
  missingFonts: string[];
  dispose(): void;
}

function ensureHost(doc: Document, geometry: PageGeometry, css: string): HTMLElement {
  let host = doc.getElementById(HOST_ID) as HTMLDivElement | null;
  if (!host) {
    host = doc.createElement('div');
    host.id = HOST_ID;
    doc.body.appendChild(host);
  }
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:absolute',
    'left:-10000px',
    'top:0',
    'visibility:hidden',
    'pointer-events:none',
    'z-index:-1',
    `width:${geometry.contentWidthMm}mm`,
    'font-size:inherit',
  ].join(';');
  host.innerHTML = `<style>${css}</style><div class="qp-measure-body" style="width:${geometry.contentWidthMm}mm;"></div>`;
  return host;
}

/**
 * Builds a measurer bound to an offscreen host. Call `createDomMeasurer` after
 * the fonts are ready (or let it await them) and dispose it when done.
 */
export async function createDomMeasurer(
  doc: Document,
  layout: QuestionPaperLayout,
  geometry: PageGeometry,
  options: { requireFonts?: boolean } = {}
): Promise<DomMeasurerHandle> {
  if (options.requireFonts !== false) {
    await awaitFontsReady(doc);
  }
  const readiness = verifyFontsLoaded(doc);
  const css = buildQuestionPaperCss(layout, geometry);
  const host = ensureHost(doc, geometry, css);
  const body = host.querySelector('.qp-measure-body') as HTMLDivElement;

  const measureNode = (node: HTMLElement): number => {
    const rect = node.getBoundingClientRect();
    const styles = doc.defaultView ? doc.defaultView.getComputedStyle(node) : null;
    const marginTop = styles ? parseFloat(styles.marginTop) || 0 : 0;
    const marginBottom = styles ? parseFloat(styles.marginBottom) || 0 : 0;
    return pxToMm(rect.height + marginTop + marginBottom);
  };

  const measurer: BlockMeasurer = {
    measureFragment(fragment: QuestionFragment) {
      const probe = doc.createElement('div');
      probe.innerHTML = fragment.html;
      body.innerHTML = '';
      body.appendChild(probe);
      return measureNode(probe);
    },
    measureTextMm(text: string, fontSizePt: number) {
      const probe = doc.createElement('span');
      probe.textContent = text || '';
      probe.style.whiteSpace = 'nowrap';
      probe.style.fontSize = `${fontSizePt}pt`;
      probe.style.fontFamily = getComputedStyle(body).fontFamily;
      body.innerHTML = '';
      body.appendChild(probe);
      return pxToMm(probe.getBoundingClientRect().width);
    },
  };

  return {
    measurer,
    fontsReady: readiness.ready,
    missingFonts: readiness.missing,
    dispose() {
      body.innerHTML = '';
      if (host && host.parentNode) host.parentNode.removeChild(host);
    },
  };
}

/**
 * Convenience helper for a one-off measurement pass (used by the tests and by
 * the Puppeteer export before it renders the final document).
 */
export async function measureBlocks(
  doc: Document,
  blocks: PaperBlock[],
  layout: QuestionPaperLayout,
  geometry: PageGeometry
): Promise<{ heights: number[]; fontsReady: boolean; missingFonts: string[] }> {
  const handle = await createDomMeasurer(doc, layout, geometry);
  try {
    const heights = blocks.map(block =>
      block.fragments.length === 0
        ? handle.measurer.measureFragment(
            { key: `${block.id}-raw`, html: block.html, text: block.text, splittable: false },
            { contentWidthMm: geometry.contentWidthMm, block }
          )
        : block.fragments.reduce(
            (sum, fragment) =>
              sum + handle.measurer.measureFragment(fragment, { contentWidthMm: geometry.contentWidthMm, block }),
            0
          )
    );
    return { heights, fontsReady: handle.fontsReady, missingFonts: handle.missingFonts };
  } finally {
    handle.dispose();
  }
}

export { mmToPx, pxToMm };
