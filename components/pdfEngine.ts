import { Blueprint, QuestionPaperType, BlueprintItem } from '../types';
import { sortBlueprintItems } from '../utils/reportCalculations';
import { computeQuestionNumbersMap } from './BlueprintMatrix';

export function getCurrentAcademicYear() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    if (month >= 5) {
        return `${year}-${year + 1}`;
    } else {
        return `${year - 1}-${year}`;
    }
}

export const applyMixedFonts = (text: string): string => {
    if (!text) return '';
    // Strip nbsp entities before they get broken up by the font regex
    text = text.replace(/(&nbsp;|&amp;nbsp;)/gi, ' ');
    const parts = text.split(/(<[^>]+>)/g);
    return parts.map(part => {
        if (part.startsWith('<') && part.endsWith('>')) {
            return part;
        }
        return part.replace(/([a-zA-Z0-9\-\:\(\)\.\,\|\[\]\+\=\/]+)/g, '<span style="font-family: \'Times New Roman\', serif;">$1</span>');
    }).join('');
};

export const measureTextWidth = (text: string, fontFamily: string, fontSize: string): number => {
    if (typeof document === 'undefined') return 0;
    const span = document.createElement('span');
    span.style.fontFamily = fontFamily || 'TAU-Paalai, serif';
    span.style.fontSize = fontSize || '14pt';
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'nowrap';
    span.innerText = text;
    document.body.appendChild(span);
    const width = span.getBoundingClientRect().width;
    document.body.removeChild(span);
    return width;
};

const parseMCQFromDOM = (html: string, markers: string[]) => {
    if (typeof document === 'undefined') return null;
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    const textNodes: ChildNode[] = [];
    const walk = (node: ChildNode) => {
        if (node.nodeType === 3) {
            textNodes.push(node);
        } else {
            node.childNodes.forEach(walk);
        }
    };
    walk(temp);
    
    const markerNodes: { marker: string; node: ChildNode; index: number; markerIndex: number }[] = [];
    markers.forEach((marker) => {
        let foundNode: ChildNode | null = null;
        let markerIndex = -1;
        for (let i = 0; i < textNodes.length; i++) {
            const val = textNodes[i].nodeValue || '';
            const idx = val.indexOf(marker);
            if (idx >= 0) {
                foundNode = textNodes[i];
                markerIndex = idx;
                break;
            }
        }
        if (foundNode) {
            markerNodes.push({ marker, node: foundNode, index: textNodes.indexOf(foundNode), markerIndex });
        }
    });
    
    if (markerNodes.length < 4) return null;
    
    for (let i = 0; i < 3; i++) {
        if (markerNodes[i].index > markerNodes[i + 1].index) return null;
        if (markerNodes[i].index === markerNodes[i + 1].index && markerNodes[i].markerIndex > markerNodes[i + 1].markerIndex) return null;
    }
    
    const optionsText: string[] = [];
    for (let i = 0; i < 4; i++) {
        const current = markerNodes[i];
        const next = markerNodes[i + 1];
        
        let optText = '';
        const currNode = current.node;
        const val = currNode.nodeValue || '';
        optText += val.substring(current.markerIndex + current.marker.length);
        
        if (next) {
            const currIdx = textNodes.indexOf(currNode);
            const nextIdx = textNodes.indexOf(next.node);
            
            if (currIdx === nextIdx) {
                optText = val.substring(current.markerIndex + current.marker.length, next.markerIndex);
            } else {
                for (let j = currIdx + 1; j < nextIdx; j++) {
                    optText += textNodes[j].nodeValue || '';
                }
                optText += (next.node.nodeValue || '').substring(0, next.markerIndex);
            }
        } else {
            const currIdx = textNodes.indexOf(currNode);
            for (let j = currIdx + 1; j < textNodes.length; j++) {
                optText += textNodes[j].nodeValue || '';
            }
        }
        optionsText.push(optText.replace(/\s+/g, ' ').trim());
    }
    
    const firstMarker = markerNodes[0];
    const firstNode = firstMarker.node;
    const firstNodeVal = firstNode.nodeValue || '';
    firstNode.nodeValue = firstNodeVal.substring(0, firstMarker.markerIndex);
    
    const firstMarkerIdx = textNodes.indexOf(firstNode);
    for (let j = firstMarkerIdx + 1; j < textNodes.length; j++) {
        textNodes[j].nodeValue = '';
    }
    
    const cleanUp = (node: Node) => {
        if (node.nodeType === 1) {
            const el = node as HTMLElement;
            for (let i = el.childNodes.length - 1; i >= 0; i--) cleanUp(el.childNodes[i]);
            if (el.childNodes.length === 0 && el.tagName !== 'IMG' && el.tagName !== 'BR') {
                el.parentNode?.removeChild(el);
            }
        }
    };
    cleanUp(temp);
    
    return { stem: temp.innerHTML.trim(), options: optionsText };
};

export const formatQuestionFonts = (html: string) => {
    if (!html) return '';
    html = html.replace(/(&nbsp;|&amp;nbsp;)/g, ' ');
    if (typeof document === 'undefined') return html;
    try {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        const walk = (node: Node) => {
            if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).style.fontFamily?.includes('Times New Roman')) return;
            
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                const regex = /([A-Za-z0-9\-\:\(\)\.\,\|]+)/g;
                if (regex.test(text)) {
                    const span = document.createElement('span');
                    span.innerHTML = text.replace(regex, '<span style="font-family: \'Times New Roman\', serif;">$1</span>');
                    node.parentNode?.replaceChild(span, node);
                }
            } else {
                const children = Array.from(node.childNodes);
                children.forEach(walk);
            }
        };
        
        walk(temp);
        return temp.innerHTML;
    } catch (e) {
        return html;
    }
};

export const formatMark = (m: number) => {
    const s = m.toString();
    if (s.endsWith('.5')) {
        const whole = s.split('.')[0];
        return whole === '0' ? '½' : `${whole}½`;
    }
    return s;
};

export const toRoman = (num: number) => {
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return roman[num - 1] || num.toString();
};

export const generateCoverHeader = (bp: Blueprint, paperCode?: string) => {
    const year = (bp.academicYear || getCurrentAcademicYear()).replace(/^(\d{4})-(\d{2,4})$/, (_, start, end) => `${start}-${String(end).slice(-2)}`);
    const setLetter = (bp.setId || 'A').replace(/SET\s+/i, '').trim().charAt(0).toUpperCase();
    const yearStr = `<span style="font-family: 'Times New Roman', serif;">${year}</span>`;

    let termHeading = `முதல்பருவத் தொகுத்தறி மதிப்பீடு ${yearStr}`;
    if (bp.examTerm === 'Second Term Summative') termHeading = `இரண்டாம் பருவத் தொகுத்தறி மதிப்பீடு ${yearStr}`;
    if (bp.examTerm === 'Third Term Summative') termHeading = `இறுதிப் பருவத் தொகுத்தறி மதிப்பீடு ${yearStr}`;

    const subjectTitle = bp.subject.includes('AT')
        ? { tamil: 'தமிழ் முதல் தாள்', eng: 'Tamil Language Paper I (AT)' }
        : { tamil: 'தமிழ் இரண்டாம் தாள்', eng: 'Tamil Language Paper II (BT)' };

    return `
    <div class="pdf-cover-header" style="padding-top: 0; margin-top: 0; margin-bottom: 15px; font-family: 'TAU-Paalai', serif; line-height: 1.2; text-align: center; color: #000; position: relative; width: 100%; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; position: relative; z-index: 10000;">
            <div style="background-color: #000; color: #fff; padding: 6px 14px; font-family: 'Times New Roman', serif; font-weight: bold; font-size: 1.1em; border-radius: 4px; min-width: 30px; text-align: center;">${setLetter}</div>
            <div style="background-color: #000; color: #fff; padding: 6px 14px; font-family: 'Times New Roman', serif; font-weight: bold; font-size: 1.1em; border-radius: 4px; min-width: 60px; text-align: center;">${paperCode || ''}</div>
        </div>
        <div style="display: flex; justify-content: center; align-items: center; position: relative; z-index: 10000;">
            <h1 style="font-weight: bold; font-size: 1.7em; margin: 0; letter-spacing: 0.5px; font-family: 'TAU-Paalai', serif; white-space: nowrap;">சமக்ர சிக்ஷா கேரளம்</h1>
        </div>
        <div style="margin-top: 15px; position: relative; z-index: 10000;">
            <h2 style="font-size: 1.2em; font-weight: bold; margin: 0; font-family: 'TAU-Paalai', serif;">${termHeading}</h2>
            <h2 style="font-size: 1.2em; font-weight: bold; margin: 8px 0 0 0; font-family: 'TAU-Paalai', serif;">${subjectTitle.tamil}</h2>
            <h3 style="font-size: 1.1em; font-weight: bold; margin: 5px 0 0 0; font-family: 'Times New Roman', serif;">${subjectTitle.eng}</h3>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; font-family: 'Times New Roman', 'TAU-Paalai', serif; font-weight: bold; margin-top: 5px; font-size: 1em; text-align: left; color: #000; position: relative; z-index: 10000;">
            <div style="line-height: 1.6;">நேரம்: <span style="font-family: 'Times New Roman', serif;">90</span> நிமிடம்<br/>சிந்தனை நேரம் : <span style="font-family: 'Times New Roman', serif;">15</span> நிமிடம்</div>
            <div style="text-align: right; line-height: 1.6;">வகுப்பு: <span style="font-family: 'Times New Roman', serif;">${bp.classLevel}</span><br/>மதிப்பெண்: <span style="font-family: 'Times New Roman', serif;">${formatMark(bp.totalMarks)}</span></div>
        </div>
    </div>`;
};

export const generateNotesBox = () => {
    return `
    <div class="pdf-notes-box" style="border: 1px solid black; padding: 8px 10px; margin-top: 10px; margin-bottom: 15px; font-family: 'TAU-Paalai', 'Times New Roman', serif; font-size: 11pt; line-height: 1.6; text-align: left; color: #000; box-sizing: border-box; width: 100%;">
        <div style="font-weight: bold; margin-bottom: 5px;">குறிப்புகள்:</div>
        <div style="margin-left: 10px;">
            <div style="display: flex; gap: 8px; margin-bottom: 4px;"><span>◆</span><span>முதல் 15 நிமிடம் சிந்தனை நேரமாகும்.</span></div>
            <div style="display: flex; gap: 8px; margin-bottom: 4px;"><span>◆</span><span>வினாக்களை வாசித்து விடைகளை வரிசைப்படுத்த இந்த நேரத்தைப் பயன்படுத்தலாம்.</span></div>
            <div style="display: flex; gap: 8px; margin-bottom: 4px;"><span>◆</span><span>வினாக்களையும் குறிப்புகளையும் நன்கு வாசித்துப் புரிந்து விடையளிக்கவும்.</span></div>
            <div style="display: flex; gap: 8px; margin-bottom: 4px;"><span>◆</span><span>விடையளிக்கும்போது மதிப்பெண், நேரம் போன்றவற்றை கவனித்துச் செயல்படவும்.</span></div>
        </div>
    </div>`;
};

export const generateSectionHeader = (roman: string, titlePart: string, marksRateStr: string, marksTotalStr: string) => {
    return `
    <div class="pdf-section-header" style="font-weight: bold; margin-top: 10px; margin-bottom: 8px; page-break-inside: avoid; break-inside: avoid; display: flex; justify-content: space-between; align-items: flex-end; box-sizing: border-box; width: 100%;">
        <div style="display: flex; align-items: flex-start; flex-grow: 1; padding-right: 15px;">
            <div style="font-family: 'Times New Roman', serif; font-weight: bold; font-size: 1.1em; width: 10mm; flex-shrink: 0; text-align: left;">${roman}.</div>
            <div style="font-family: 'TAU-Paalai', serif; font-weight: bold; font-size: 1em; text-align: justify; margin-left: 2mm;">
                <div>${applyMixedFonts(titlePart)} <span style="font-weight: normal;">${applyMixedFonts(marksRateStr)}</span></div>
            </div>
        </div>
        <div style="font-family: 'Times New Roman', serif; font-weight: bold; font-size: 1.1em; white-space: nowrap; flex-shrink: 0;">
            ${applyMixedFonts(marksTotalStr)}
        </div>
    </div>`;
};

export const renderMCQ = (questionHtml: string, itemFormat: string | undefined): string => {
    if (!questionHtml) return '';
    let markers = ['அ)', 'ஆ)', 'இ)', 'ஈ)'];
    let parsed = parseMCQFromDOM(questionHtml, markers);
    if (!parsed) {
        markers = ['அ.', 'ஆ.', 'இ.', 'ஈ.'];
        parsed = parseMCQFromDOM(questionHtml, markers);
    }
    if (!parsed) return questionHtml;

    let isLong = false;
    const font = 'TAU-Paalai';
    const size = '14pt';
    const limit = 304; // 50% width in pixels approx

    parsed.options.forEach((opt) => {
        if (measureTextWidth(opt, font, size) > limit) isLong = true;
    });

    const stemCleaned = parsed.stem.replace(/<p\b[^>]*>/gi, '<p style="margin: 0; padding: 0;">');

    if (isLong) {
        return `
        <div style="margin-bottom: 4px;">${stemCleaned}</div>
        <div style="margin-top: 0; font-family: 'TAU-Paalai', serif; line-height: 1.8;">
          ${parsed.options.map((opt, i) => `
            <div style="padding: 2px 0; text-align: left; display: flex; align-items: flex-start;">
              <span style="font-family: 'TAU-Paalai Bold', 'TAU-Paalai', serif; font-weight: bold; width: 8mm; flex-shrink: 0;">${markers[i]}</span>
              <span style="flex-grow: 1;">${opt}</span>
            </div>
          `).join('')}
        </div>`;
    } else {
        return `
        <div style="margin-bottom: 4px;">${stemCleaned}</div>
        <table style="width: 100%; border: none !important; border-collapse: collapse; margin-top: 0; font-family: 'TAU-Paalai', serif; line-height: 1.8;">
          <tr style="border: none !important;">
            <td style="width: 50%; border: none !important; padding: 2px 0; text-align: left; vertical-align: top;">
              <div style="display: flex; align-items: flex-start;">
                <span style="font-family: 'TAU-Paalai Bold', 'TAU-Paalai', serif; font-weight: bold; width: 8mm; flex-shrink: 0;">${markers[0]}</span>
                <span style="flex-grow: 1;">${parsed.options[0]}</span>
              </div>
            </td>
            <td style="width: 50%; border: none !important; padding: 2px 0; text-align: left; vertical-align: top;">
              <div style="display: flex; align-items: flex-start;">
                <span style="font-family: 'TAU-Paalai Bold', 'TAU-Paalai', serif; font-weight: bold; width: 8mm; flex-shrink: 0;">${markers[1]}</span>
                <span style="flex-grow: 1;">${parsed.options[1]}</span>
              </div>
            </td>
          </tr>
          <tr style="border: none !important;">
            <td style="width: 50%; border: none !important; padding: 2px 0; text-align: left; vertical-align: top;">
              <div style="display: flex; align-items: flex-start;">
                <span style="font-family: 'TAU-Paalai Bold', 'TAU-Paalai', serif; font-weight: bold; width: 8mm; flex-shrink: 0;">${markers[2]}</span>
                <span style="flex-grow: 1;">${parsed.options[2]}</span>
              </div>
            </td>
            <td style="width: 50%; border: none !important; padding: 2px 0; text-align: left; vertical-align: top;">
              <div style="display: flex; align-items: flex-start;">
                <span style="font-family: 'TAU-Paalai Bold', 'TAU-Paalai', serif; font-weight: bold; width: 8mm; flex-shrink: 0;">${markers[3]}</span>
                <span style="flex-grow: 1;">${parsed.options[3]}</span>
              </div>
            </td>
          </tr>
        </table>`;
    }
};

export const processQuestionText = (text: string, format: string | undefined) => {
    const mcqFormatted = renderMCQ(text, format);
    return applyMixedFonts(mcqFormatted);
};

export const renderQuestion = (item: any, qNoDisp: string) => {
    const questionText = processQuestionText(item.questionText || '(Question not entered)', item.itemFormat);
    return `<div style="font-family: 'TAU-Paalai', 'Times New Roman', serif; font-size: 1em; line-height: 1.8; text-align: justify; margin-bottom: 8px; display: flex; align-items: flex-start; page-break-inside: avoid; break-inside: avoid;">
        <div style="width: 8mm; flex-shrink: 0; font-family: 'Times New Roman', serif; font-weight: bold; text-align: left;">${qNoDisp}.</div>
        <div style="margin-left: 2mm; flex-grow: 1; text-align: justify;">${questionText}</div>
    </div>`;
};

export const renderInternalChoice = (item: any, qNoDisp: string) => {
    const questionText = processQuestionText(item.questionText || '(Question not entered)', item.itemFormat);
    const questionTextB = processQuestionText(item.questionTextB || '(Question not entered)', item.itemFormatB || item.itemFormat);
    
    return `
    <div class="pdf-question-block pdf-choice-block" style="font-family: 'TAU-Paalai', 'Times New Roman', serif; font-size: 1em; line-height: 1.8; text-align: justify; margin-bottom: 6px; page-break-inside: avoid; break-inside: avoid;">
        <div style="display: flex; align-items: flex-start; margin-bottom: 4px;">
            <div style="width: 8mm; flex-shrink: 0; font-family: 'Times New Roman', serif; font-weight: bold; text-align: left;">${qNoDisp}.</div>
            <div style="margin-left: 2mm; flex-grow: 1; text-align: justify; font-weight: bold;">ஏதேனும் ஒன்றிற்கு விடையளிக்கவும்.</div>
        </div>
        <div style="display: flex; align-items: flex-start; margin-left: 10mm; margin-top: 4px; margin-bottom: 4px;">
            <div style="width: 6mm; flex-shrink: 0; font-family: 'TAU-Paalai Bold', 'TAU-Paalai', serif; font-weight: bold; text-align: left;">அ)</div>
            <div style="flex-grow: 1; text-align: justify;">${questionText}</div>
        </div>
        <div style="text-align: center; font-weight: bold; margin: 4px 0; margin-left: 10mm; white-space: nowrap;">(அல்லது)</div>
        <div style="display: flex; align-items: flex-start; margin-left: 10mm; margin-top: 4px;">
            <div style="width: 6mm; flex-shrink: 0; font-family: 'TAU-Paalai Bold', 'TAU-Paalai', serif; font-weight: bold; text-align: left;">ஆ)</div>
            <div style="flex-grow: 1; text-align: justify;">${questionTextB}</div>
        </div>
    </div>`;
};

export const buildFullQuestionPaperHTML = (bp: Blueprint, pt: QuestionPaperType | undefined, paperCode?: string): string => {
    let content = generateCoverHeader(bp, paperCode);
    content += generateNotesBox();

    const bpItems = bp.items || [];

    if (pt && pt.sections && pt.sections.length > 0) {
        const orderedItems = sortBlueprintItems(bpItems, null, pt);
        const questionNumbersMap = computeQuestionNumbersMap(bpItems, pt.sections, null, pt);

        pt.sections.forEach((section, sIdx) => {
            const sectionItems = orderedItems.filter(item => item.sectionId === section.id).sort((a, b) => {
                const strA = String(questionNumbersMap.get(a.id) || '').replace(/^Q#\s*/i, '').trim();
                const strB = String(questionNumbersMap.get(b.id) || '').replace(/^Q#\s*/i, '').trim();
                const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
                if (cmp !== 0) return cmp;
                // Stable fallback if question numbers are identical
                return a.id.localeCompare(b.id);
            });
            
            if (sectionItems.length === 0) return;

            const firstQNoStr = String(questionNumbersMap.get(sectionItems[0].id) || '').replace('Q# ', '');
            const lastQNoStr = String(questionNumbersMap.get(sectionItems[sectionItems.length - 1].id) || '').replace('Q# ', '');
            const rangeStr = firstQNoStr === lastQNoStr ? `${firstQNoStr} ஆவது வினாவிற்கு` : `${firstQNoStr} முதல் ${lastQNoStr} வரையுள்ள`;
            const roman = toRoman(sIdx + 1);

            let cleanInstruction = (section.instruction || '').trim()
                .replace(/\(\s*\d+(\.5)?\s*மதிப்பெண்\s*வீதம்\s*\)/g, '')
                .replace(/\(\s*\d+\s*[xX*]\s*\d+(\.5)?\s*=\s*\d+(\.5)?\s*\)/g, '')
                .trim();

            const isFormatted = /^[IVX]+\./.test(cleanInstruction) || /\d+\s*முதல்\s*\d+/.test(cleanInstruction);
            const marksTotal = section.count * section.marks;
            const marksRateStr = `<span style="white-space: nowrap;">(${formatMark(section.marks)} மதிப்பெண் வீதம்)</span>`;
            const marksTotalStr = `<span style="white-space: nowrap;">(${section.count} × ${formatMark(section.marks)} = ${formatMark(marksTotal)})</span>`;

            let romanPart = roman;
            let titlePart = '';
            if (isFormatted) {
                const match = cleanInstruction.match(/^([IVX]+)\.\s*(.*)$/);
                if (match) {
                    romanPart = match[1];
                    titlePart = match[2];
                } else {
                    titlePart = cleanInstruction;
                }
            } else {
                titlePart = `${rangeStr} ${cleanInstruction}`;
            }

            content += generateSectionHeader(romanPart, titlePart, marksRateStr, marksTotalStr);

            sectionItems.forEach((item) => {
                const qNoDisp = String(questionNumbersMap.get(item.id) || '').replace('Q# ', '');
                if (item.hasInternalChoice) {
                    content += renderInternalChoice(item, qNoDisp);
                } else {
                    content += renderQuestion(item, qNoDisp);
                }
            });
        });

        // Unmatched logic
        const matchedIds = new Set(pt.sections.flatMap(s => bpItems.filter(i => i.sectionId === s.id).map(i => i.id)));
        const unmatched = bpItems.filter(i => !matchedIds.has(i.id));
        if (unmatched.length > 0) {
            content += `<div style="font-family: 'TAU-Paalai', serif; font-size: 1em; font-weight: bold; margin-top: 12px; margin-bottom: 8px; page-break-inside: avoid; break-inside: avoid;">மேலும் வினாக்கள்</div>`;
            unmatched.forEach(item => {
                const qNoDisp = String(questionNumbersMap.get(item.id) || '').replace('Q# ', '');
                if (item.hasInternalChoice) {
                    content += renderInternalChoice(item, qNoDisp);
                } else {
                    content += renderQuestion(item, qNoDisp);
                }
            });
        }
    } else {
        bpItems.forEach((item, index) => {
            const qNoDisp = (index + 1).toString();
            if (item.hasInternalChoice) {
                content += renderInternalChoice(item, qNoDisp);
            } else {
                content += renderQuestion(item, qNoDisp);
            }
        });
    }

    content += `<div class="last-page-decoration" style="text-align: center; margin-top: 15px; margin-bottom: 0px; font-size: 14pt; clear: both; page-break-inside: avoid; break-inside: avoid; display: block; width: 100%; font-family: 'Times New Roman', serif;">──── ✦ ✦ ✦ ────</div>`;
    return content.replace(/(&nbsp;|&amp;nbsp;)/gi, ' ');
};
