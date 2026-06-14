import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, WidthType, BorderStyle, VerticalAlign, ShadingType, TextDirection } from "docx";
import { saveAs } from "file-saver";
import { Blueprint, Curriculum, BlueprintItem, Discourse } from "../types";

// Helper constants for styling
const BLACK = "000000";
const GREEN_HEADER = "E2EFDA";
const PURPLE_SOFT = "F5E6FF";
const GREY_LIGHT = "F3F4F6";

/**
 * Service to export blueprint answer key to Word document
 */
export class DocExportService {

    private static getItemQuestionCount(item: BlueprintItem) {
        return Math.max(item.questionCount || 1, 1);
    }

    private static getItemTotalScore(item: BlueprintItem) {
        return this.getItemQuestionCount(item) * (item.marksPerQuestion || 0);
    }

    private static createTextRuns(text: string, options: { bold?: boolean, size?: number, italic?: boolean, font?: string, color?: string } = {}) {
        if (!text) return [new TextRun("")];
        
        // Split text by Tamil characters vs others to apply different fonts/sizes
        const segments = text.split(/([அ-ஹ\u0B80-\u0BFF]+)/g).filter(Boolean);
        
        return segments.map(seg => {
            const isTamil = /[அ-ஹ\u0B80-\u0BFF]/.test(seg);
            return new TextRun({
                text: seg,
                bold: options.bold,
                italics: options.italic,
                size: options.size || (isTamil ? 28 : 22), // 14pt and 11pt
                font: options.font || (isTamil ? "TAU-Paalai" : "Times New Roman"),
                color: options.color || BLACK
            });
        });
    }

    private static createTableCell(text: string, options: {
        bold?: boolean,
        size?: number,
        align?: any,
        rowSpan?: number,
        colSpan?: number,
        shading?: string,
        italic?: boolean,
        font?: string,
        noBorder?: boolean,
        vertical?: boolean,
        spacing?: { before: number, after: number }
    } = {}) {
        return new TableCell({
            children: [
                new Paragraph({
                    children: this.createTextRuns(text, options),
                    alignment: options.align || AlignmentType.CENTER,
                    spacing: options.spacing || { before: 100, after: 100 }
                }),
            ],
            rowSpan: options.rowSpan,
            columnSpan: options.colSpan,
            shading: options.shading ? { fill: options.shading, type: ShadingType.CLEAR } : undefined,
            verticalAlign: VerticalAlign.CENTER,
            textDirection: options.vertical ? TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT : undefined,
            borders: options.noBorder ? {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
            } : {
                top: { style: BorderStyle.SINGLE, size: 1, color: BLACK },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: BLACK },
                left: { style: BorderStyle.SINGLE, size: 1, color: BLACK },
                right: { style: BorderStyle.SINGLE, size: 1, color: BLACK },
            }
        });
    }

    private static createRichParagraph(text: string, options: {
        bold?: boolean,
        size?: number,
        align?: any,
        color?: string,
        italic?: boolean,
        font?: string,
        spacingBefore?: number,
        spacingAfter?: number
    } = {}) {
        return new Paragraph({
            children: this.createTextRuns(text, options),
            alignment: options.align || AlignmentType.LEFT,
            spacing: { 
                before: options.spacingBefore !== undefined ? options.spacingBefore : 100, 
                after: options.spacingAfter !== undefined ? options.spacingAfter : 100 
            }
        });
    }

    private static getAcademicYear(blueprint: Blueprint) {
        if (blueprint.academicYear) return blueprint.academicYear;
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        if (month <= 4) return `${year - 1}-${year}`;
        return `${year}-${year + 1}`;
    }

    private static getTermTamil(term: string) {
        switch (term) {
            case 'First Term Summative': return 'முதல்';
            case 'Second Term Summative': return 'இரண்டாம்';
            case 'Third Term Summative': return 'இறுதி';
            default: return 'முதல்';
        }
    }

    private static getSubjectInfo(subject: string) {
        if (subject.includes('AT')) {
            return { tamil: 'தமிழ் முதல் தாள்', eng: 'Tamil Language Paper I (AT)', code: '02' };
        }
        return { tamil: 'தமிழ் இரண்டாம் தாள்', eng: 'Tamil Language Paper II (BT)', code: '12' };
    }

    private static getPaperCode(blueprint: Blueprint) {
        const subInfo = this.getSubjectInfo(blueprint.subject);
        return `GI${blueprint.classLevel}${subInfo.code}`;
    }

    /**
     * Export Answer Key
     */
    static async exportAnswerKey(blueprint: Blueprint, curriculum: Curriculum, discourses: Discourse[] = []) {
        const subInfo = this.getSubjectInfo(blueprint.subject);
        const academicYear = this.getAcademicYear(blueprint);
        const termTamil = this.getTermTamil(blueprint.examTerm);
        const setId = (blueprint.setId || 'A').replace(/SET\s+/i, '').trim().charAt(0).toUpperCase();
        const qpCode = this.getPaperCode(blueprint);

        // Sort items: Marks Ascending -> Unit Order Ascending
        const unitOrderMap = new Map<string, number>();
        curriculum?.units.forEach((u) => {
            unitOrderMap.set(u.id, u.unitNumber);
        });

        const sortedItems = [...blueprint.items].sort((a, b) => {
            if (a.marksPerQuestion !== b.marksPerQuestion) {
                return a.marksPerQuestion - b.marksPerQuestion;
            }
            const unitA = unitOrderMap.get(a.unitId) || 999;
            const unitB = unitOrderMap.get(b.unitId) || 999;
            return unitA - unitB;
        });

        const cleanHtml = (html: string) => {
            if (!html) return "";
            return html
                .replace(/<p[^>]*>/g, "")
                .replace(/<\/p>/g, "\n")
                .replace(/<br\s*\/?>/g, "\n")
                .replace(/<[^>]*>/g, "")
                .replace(/&nbsp;/g, " ")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .trim();
        };

        const renderItemAnswerForWord = (item: BlueprintItem, isOptionB = false) => {
            const enableInput = isOptionB ? item.enableInputAnswerB : item.enableInputAnswer;
            const structured = isOptionB ? item.structuredAnswersB : item.structuredAnswers;
            const writeContent = isOptionB ? item.answerTextB : item.answerText;
            const enableWrite = isOptionB ? item.enableWriteContentB : item.enableWriteContent;
            const enableDiscourse = isOptionB ? item.enableDiscourseB : item.enableDiscourse;
            const discourseId = isOptionB ? item.discourseIdB : item.discourseId;

            let textParts: string[] = [];

            // 1. Write Content
            if (enableWrite && writeContent && writeContent.trim()) {
                const cleaned = cleanHtml(writeContent);
                if (cleaned) textParts.push(cleaned);
            }

            // 2. Discourse
            if (enableDiscourse && discourseId && discourses.length > 0) {
                const d = discourses.find(x => x.id === discourseId);
                if (d) {
                    textParts.push(`Discourse: ${d.name}`);
                    if (d.description) textParts.push(cleanHtml(d.description));
                    if (d.rubrics && d.rubrics.length > 0) {
                        d.rubrics.forEach(r => {
                            textParts.push(`- ${r.point}: ${r.marks} Marks`);
                        });
                    }
                }
            }

            // 3. Structured Answers
            if (enableInput && structured && structured.length > 0) {
                structured.forEach(v => {
                    textParts.push(`- ${v.answer}: ${v.mark} Marks`);
                });
            }

            return textParts.join("\n\n");
        };

        const rows = [
            new TableRow({
                children: [
                    this.createTableCell("Q. No", { bold: true, shading: GREY_LIGHT, size: 24, font: "Times New Roman" }),
                    this.createTableCell("Score", { bold: true, shading: GREY_LIGHT, size: 24, font: "Times New Roman" }),
                    this.createTableCell("Answer / Value Points", { bold: true, shading: GREY_LIGHT, size: 24, font: "Times New Roman" }),
                    this.createTableCell("Further Information", { bold: true, shading: GREY_LIGHT, size: 24, font: "Times New Roman" }),
                ]
            })
        ];

        sortedItems.forEach((item, idx) => {
            const answer = renderItemAnswerForWord(item);
            const furtherInfo = item.enableFurtherInfo ? cleanHtml(item.furtherInfo || "") : "";
            const score = this.getItemTotalScore(item).toString().replace('.5', '½');

            if (!item.hasInternalChoice) {
                rows.push(new TableRow({
                    children: [
                        this.createTableCell((idx + 1).toString(), { bold: true, font: "Times New Roman" }),
                        this.createTableCell(score, { bold: true, font: "Times New Roman" }),
                        this.createTableCell(answer || "(விடை இன்னும் சேர்க்கப்படவில்லை)", { align: AlignmentType.LEFT, spacing: { before: 150, after: 150 } }),
                        this.createTableCell(furtherInfo || "-", { align: AlignmentType.LEFT, size: 22, spacing: { before: 150, after: 150 } }),
                    ]
                }));
            } else {
                rows.push(new TableRow({
                    children: [
                        this.createTableCell(`${idx + 1}(அ)`, { bold: true }),
                        this.createTableCell(score, { bold: true, font: "Times New Roman" }),
                        this.createTableCell(answer || "(விடை இன்னும் சேர்க்கப்படவில்லை)", { align: AlignmentType.LEFT, spacing: { before: 150, after: 150 } }),
                        this.createTableCell(furtherInfo || "-", { align: AlignmentType.LEFT, size: 22, spacing: { before: 150, after: 150 } }),
                    ]
                }));
                const answerB = renderItemAnswerForWord(item, true);
                const furtherInfoB = item.enableFurtherInfoB ? cleanHtml(item.furtherInfoB || "") : "";
                rows.push(new TableRow({
                    children: [
                        this.createTableCell(`${idx + 1}(ஆ)`, { bold: true, shading: PURPLE_SOFT }),
                        this.createTableCell(score, { bold: true, font: "Times New Roman", shading: PURPLE_SOFT }),
                        this.createTableCell(answerB || "(விடை இன்னும் சேர்க்கப்படவில்லை)", { align: AlignmentType.LEFT, shading: PURPLE_SOFT, spacing: { before: 150, after: 150 } }),
                        this.createTableCell(furtherInfoB || "-", { align: AlignmentType.LEFT, size: 22, shading: PURPLE_SOFT, spacing: { before: 150, after: 150 } }),
                    ]
                }));
            }
        });

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: 720, right: 720, bottom: 720, left: 720 }
                    }
                },
                children: [
                    // Main Header Table (Centered Layout)
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE },
                            insideHorizontal: { style: BorderStyle.NONE },
                            insideVertical: { style: BorderStyle.NONE },
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    this.createTableCell(setId, { bold: true, size: 40, noBorder: false, rowSpan: 2, align: AlignmentType.CENTER }),
                                    this.createTableCell("சமக்ர சிக்ஷா கேரளம்", { bold: true, size: 40, noBorder: true, colSpan: 2, align: AlignmentType.CENTER }),
                                    this.createTableCell(qpCode, { bold: true, size: 32, noBorder: false, font: "Times New Roman", align: AlignmentType.CENTER, rowSpan: 2 }),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    this.createTableCell(`${termTamil} பருவத் தொகுத்தறி மதிப்பீடு ${academicYear}`, { bold: true, size: 32, noBorder: true, colSpan: 2, align: AlignmentType.CENTER }),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    this.createTableCell("", { noBorder: true }),
                                    this.createTableCell(subInfo.tamil, { bold: true, size: 32, noBorder: true, colSpan: 2, align: AlignmentType.CENTER }),
                                    this.createTableCell("", { noBorder: true }),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    this.createTableCell("", { noBorder: true }),
                                    this.createTableCell(subInfo.eng, { bold: true, size: 24, noBorder: true, colSpan: 2, align: AlignmentType.CENTER }),
                                    this.createTableCell("", { noBorder: true }),
                                ]
                            })
                        ]
                    }),

                    new Paragraph({ text: "", spacing: { before: 200, after: 200 } }),

                    // Info Row (Left/Right Alignment)
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE },
                            insideHorizontal: { style: BorderStyle.NONE },
                            insideVertical: { style: BorderStyle.NONE },
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    this.createTableCell(`நேரம்: 90 நிமிடம்`, { align: AlignmentType.LEFT, noBorder: true, size: 24, bold: true }),
                                    this.createTableCell(`வகுப்பு: ${blueprint.classLevel}`, { align: AlignmentType.CENTER, noBorder: true, size: 24, bold: true, font: "Times New Roman" }),
                                    this.createTableCell(`மதிப்பெண்: ${blueprint.totalMarks}`, { align: AlignmentType.RIGHT, noBorder: true, size: 24, bold: true, font: "Times New Roman" }),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    this.createTableCell(`சிந்தனை நேரம்: 15 நிமிடம்`, { align: AlignmentType.LEFT, noBorder: true, size: 24, bold: true, italic: true }),
                                    this.createTableCell("", { noBorder: true, colSpan: 2 }),
                                ]
                            })
                        ]
                    }),

                    new Paragraph({ text: "", spacing: { before: 100, after: 100 } }),
                    this.createRichParagraph("ANSWER KEY & SCORING INDICATORS", { bold: true, size: 24, align: AlignmentType.CENTER, spacingAfter: 200 }),
                    
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: rows
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `AnswerKey_${blueprint.id}.docx`);
    }
}
