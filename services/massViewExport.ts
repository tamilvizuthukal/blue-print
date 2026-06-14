import { AlignmentType, BorderStyle, Document as DocxDocument, HeadingLevel, Packer, PageBreak, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType, HeightRule, VerticalAlign } from 'docx';
import { saveAs } from 'file-saver';
import { Blueprint } from '../types';

interface MassViewExportPayload {
    blueprint: Blueprint;
    questionText?: string;
    answerRows?: string[][];
    includeQuestions: boolean;
    includeAnswers: boolean;
}

const TAMIL_FONT = 'TAU-Paalai';
const ENGLISH_FONT = 'Times New Roman';
const HEADING_FONT = 'TAU-Urai';

const getBaseFileName = (blueprint: Blueprint) =>
    `MassView_${blueprint.classLevel}_${blueprint.subject.replace(/\s+/g, '_')}_${(blueprint.setId || 'SetA').replace(/\s+/g, '_')}`;

const isTamil = (text: string) => /[அ-ஹ\u0B80-\u0BFF]/.test(text);

const splitTextByLanguage = (text: string) => {
    const segments: Array<{ text: string, isTamil: boolean }> = [];
    let currentText = '';
    let currentIsTamil = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const charIsTamil = isTamil(char);

        if (i === 0) {
            currentIsTamil = charIsTamil;
            currentText = char;
        } else if (charIsTamil === currentIsTamil) {
            currentText += char;
        } else {
            segments.push({ text: currentText, isTamil: currentIsTamil });
            currentIsTamil = charIsTamil;
            currentText = char;
        }
    }
    if (currentText) {
        segments.push({ text: currentText, isTamil: currentIsTamil });
    }
    return segments;
};

const createLanguageRuns = (text: string, options: any = {}) => {
    const processedText = text.toString()
        .replace(/(\d+)\.5/g, '$1½')
        .replace(/(^|[^0-9])0\.5/g, '$1½');

    const segments = splitTextByLanguage(processedText);
    return segments.map(seg => new TextRun({
        ...options,
        text: seg.text,
        font: seg.isTamil ? TAMIL_FONT : ENGLISH_FONT,
        size: seg.isTamil ? (options.sizeTamil || options.size || 24) : (options.size || 24)
    }));
};

const htmlToDocxElements = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const elements: any[] = [];

    const processNode = (node: Node, options: any = {}) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text.trim() || text === ' ') {
                return createLanguageRuns(text, options);
            }
            return [];
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const newOptions = { ...options };

            if (el.tagName === 'B' || el.tagName === 'STRONG') newOptions.bold = true;
            if (el.tagName === 'I' || el.tagName === 'EM') newOptions.italics = true;
            if (el.tagName === 'U') newOptions.underline = { type: BorderStyle.SINGLE, color: "000000" };
            
            if (el.tagName === 'P' || el.tagName.startsWith('H')) {
                const children: any[] = [];
                el.childNodes.forEach(child => {
                    children.push(...processNode(child, newOptions));
                });
                
                let alignment = AlignmentType.LEFT;
                if (el.style.textAlign === 'center') alignment = AlignmentType.CENTER as any;
                else if (el.style.textAlign === 'right') alignment = AlignmentType.RIGHT as any;
                else if (el.style.textAlign === 'justify') alignment = AlignmentType.JUSTIFIED as any;

                return [new Paragraph({
                    alignment,
                    children,
                    spacing: { after: 120 }
                })];
            }

            const children: any[] = [];
            el.childNodes.forEach(child => {
                children.push(...processNode(child, newOptions));
            });
            return children;
        }

        return [];
    };

    doc.body.childNodes.forEach(node => {
        const processed = processNode(node);
        processed.forEach(p => {
            if (p instanceof Paragraph) elements.push(p);
            else if (Array.isArray(p)) {
                 // If we got runs, wrap them in a paragraph if not already
                 elements.push(new Paragraph({ children: p }));
            }
        });
    });

    return elements;
};

export const exportMassViewDocx = async (payload: MassViewExportPayload) => {
    const children: any[] = [];
    const bp = payload.blueprint;

    if (payload.includeQuestions && payload.questionText) {
        // If it looks like HTML (from Tiptap), use rich parsing
        if (payload.questionText.includes('<p>') || payload.questionText.includes('<h')) {
            children.push(...htmlToDocxElements(payload.questionText));
        } else {
            // Fallback to old plain text logic
            payload.questionText.split('\n').forEach(line => {
                children.push(new Paragraph({
                    children: createLanguageRuns(line)
                }));
            });
        }
    }

    if (payload.includeAnswers && payload.answerRows?.length) {
        if (children.length > 0) children.push(new Paragraph({ children: [new PageBreak()] }));

        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: createLanguageRuns("விடைக்குறிப்பு / ANSWER KEY", { bold: true, size: 28 })
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: createLanguageRuns(`${bp.academicYear} | Grade ${bp.classLevel} | ${bp.subject}`, { size: 22 })
            })
        );

        const headerRow = payload.answerRows[8] || [];
        const dataRows = payload.answerRows.slice(9);

        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: headerRow.map(cell => new TableCell({
                        shading: { fill: "F3F4F6" },
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: createLanguageRuns(cell, { bold: true, size: 20 })
                        })]
                    }))
                }),
                ...dataRows.map(row => new TableRow({
                    children: row.map((cell, idx) => new TableCell({
                        children: [new Paragraph({
                            alignment: idx === 2 ? AlignmentType.LEFT : AlignmentType.CENTER,
                            children: createLanguageRuns(cell, { size: 20 })
                        })]
                    }))
                }))
            ]
        }));
    }

    const doc = new DocxDocument({
        sections: [{
            properties: {
                page: {
                    margin: { top: 720, right: 720, bottom: 720, left: 720 }
                }
            },
            children
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${getBaseFileName(bp)}.docx`);
};

export const exportMassViewIcml = async (payload: MassViewExportPayload) => {
    // Basic implementation remains similar but could be enhanced for HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(payload.questionText || '', 'text/html');
    const plainText = doc.body.innerText;

    const lines = plainText.split('\n');

    const paragraphs = lines.map(line => `
    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle">
        <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
            <Content>${line || ' '}</Content>
        </CharacterStyleRange>
    </ParagraphStyleRange>`).join('');

    const icml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="6.0" featureSet="257" product="20.0(0)"?>
<Story Self="story_u1" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="${getBaseFileName(payload.blueprint)}">
    <StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType"/>
    <InCopyExportOption IncludeGraphicProxies="true" IncludeAllResources="false"/>
    ${paragraphs}
</Story>`;

    const blob = new Blob([icml], { type: 'application/xml;charset=utf-8' });
    saveAs(blob, `${getBaseFileName(payload.blueprint)}.icml`);
};
