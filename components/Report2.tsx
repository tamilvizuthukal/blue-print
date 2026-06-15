import React from 'react';
import { Blueprint, CognitiveProcess, KnowledgeLevel, ItemFormat } from '../types';
import { ReportHeader } from './reports/ReportHeader';
import { 
    formatMark,
    normalizeCPValue,
    normalizeLevelValue,
    normalizeFormatValue,
    cpDefinitions,
    levelDefinitions,
    formatDefinitions
} from '../services/reportUtils';
import { ReportData } from '../hooks/useReportData';

interface Report2Props {
    blueprint: Blueprint;
    data: ReportData;
}

/**
 * Report2: Item-wise Analysis
 * 
 * Features:
 * - Unified rendering for Print and Export
 * - Native table splitting with repeating headers
 * - Extreme width optimization for Learning Objectives
 */
export const Report2: React.FC<Report2Props> = ({ blueprint, data }) => {
    const { itemRows } = data;

    // Aggregates for bottom total rows (summing Option A properties of blueprint.items only, ensuring internal choice counts as 1 item)
    const columnTotals = React.useMemo(() => {
        const counts = {
            cp: { CP1: 0, CP2: 0, CP3: 0, CP4: 0, CP5: 0, CP6: 0, CP7: 0 },
            levels: { B: 0, A: 0, P: 0 },
            formats: { SR1: 0, SR2: 0, CRS1: 0, CRS2: 0, CRL: 0 }
        };
        const scores = {
            cp: { CP1: 0, CP2: 0, CP3: 0, CP4: 0, CP5: 0, CP6: 0, CP7: 0 },
            levels: { B: 0, A: 0, P: 0 },
            formats: { SR1: 0, SR2: 0, CRS1: 0, CRS2: 0, CRL: 0 }
        };
        let grandTime = 0;
        let grandItems = 0;
        let grandScore = 0;

        if (blueprint && blueprint.items) {
            blueprint.items.forEach(item => {
                const score = item.marksPerQuestion * item.questionCount;
                
                const normCP = normalizeCPValue(item.cognitiveProcess as string) as CognitiveProcess;
                const cpKey = cpDefinitions.find(d => d.value === normCP)?.key;
                
                const normKL = normalizeLevelValue(item.knowledgeLevel as string) as KnowledgeLevel;
                const klKey = levelDefinitions.find(d => d.value === normKL)?.key;
                
                const normFmt = normalizeFormatValue(item.itemFormat as string) as ItemFormat;
                const fmtKey = formatDefinitions.find(d => d.value === normFmt)?.key;

                if (cpKey) {
                    counts.cp[cpKey as keyof typeof counts.cp] += item.questionCount;
                    scores.cp[cpKey as keyof typeof scores.cp] += score;
                }
                if (klKey) {
                    counts.levels[klKey as keyof typeof counts.levels] += item.questionCount;
                    scores.levels[klKey as keyof typeof scores.levels] += score;
                }
                if (fmtKey) {
                    counts.formats[fmtKey as keyof typeof counts.formats] += item.questionCount;
                    scores.formats[fmtKey as keyof typeof scores.formats] += score;
                }

                grandTime += (item.time || 0);
                grandItems += item.questionCount;
                grandScore += score;
            });
        }

        return { counts, scores, grandTime, grandItems, grandScore };
    }, [blueprint]);

    // Extremely optimized column widths for A4 Landscape
    const textColWidths = {
        qNo: '28px',
        lo: '290px',   // Slightly shortened for Learning Objective
        unit: '125px', // Slightly widened for Topic / Unit / Chapter
        subTopic: '85px'
    };
    
    // Minimal width for data columns (fits "1(10)")
    const dataColWidth = '24px';

    const cellStyle = "border border-black p-0.5 text-center english-font text-[8px]";
    const headerStyle = "border border-black p-0.5 text-center font-bold text-[8px] bg-transparent";

    return (
        <div className="report2-container w-full">
            <div className="report-page bg-white p-[15mm] print:p-0 text-black shadow-lg mx-auto relative landscape" 
                 style={{ width: '297mm', minHeight: '210mm', boxSizing: 'border-box' }}>
                
                <ReportHeader blueprint={blueprint} sectionTitle="PART – II : ITEM-WISE ANALYSIS" orientation="landscape" />

                <table className="w-full border-collapse border-2 border-black leading-tight mt-4" style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr className="bg-transparent">
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: textColWidths.qNo }}>Qn</th>
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: textColWidths.lo }}>Learning Objective</th>
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: textColWidths.unit }}>Topic / Unit / Chapter</th>
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: textColWidths.subTopic }}>Sub Topic</th>
                            
                            <th colSpan={7} className="border border-black p-1 font-bold text-[8px]">Cognitive Process</th>
                            <th colSpan={3} className="border border-black p-1 font-bold text-[8px]">Level</th>
                            <th colSpan={5} className="border border-black p-1 font-bold text-[8px]">Format</th>
                            
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: dataColWidth }}>Items</th>
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: dataColWidth }}>Score</th>
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: dataColWidth }}>Time</th>
                        </tr>
                        <tr className="bg-transparent">
                            {['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7'].map(cp => <th key={cp} className={headerStyle} style={{ width: dataColWidth }}>{cp}</th>)}
                            {['B', 'A', 'P'].map(kl => <th key={kl} className={headerStyle} style={{ width: dataColWidth }}>{kl}</th>)}
                            {['SR1', 'SR2', 'CRS1', 'CRS2', 'CRL'].map(fmt => <th key={fmt} className={headerStyle} style={{ width: dataColWidth }}>{fmt}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {itemRows.map((row, idx) => (
                            <tr key={idx} className="bg-transparent">
                                <td className="border border-black p-0.5 text-center font-bold english-font text-[8px]">{row.qNo}</td>
                                <td className="border border-black p-1 text-left text-[8pt] leading-tight tamil-font" 
                                    style={{ 
                                        wordBreak: 'normal', 
                                        overflowWrap: 'break-word', 
                                        whiteSpace: 'normal',
                                        lineBreak: 'strict'
                                    }}>
                                    {row.learningObjective}
                                </td>
                                <td className="border border-black p-1 text-left text-[8pt] leading-tight tamil-font" 
                                    style={{ wordBreak: 'normal', overflowWrap: 'break-word', whiteSpace: 'normal' }}>
                                    {row.unit}
                                </td>
                                <td className="border border-black p-1 text-left text-[8pt] leading-tight tamil-font" 
                                    style={{ wordBreak: 'normal', overflowWrap: 'break-word', whiteSpace: 'normal' }}>
                                    {row.subTopic}
                                </td>
                                
                                {/* CP Columns */}
                                {['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7'].map(cp => (
                                    <td key={cp} className={cellStyle}>{row.cp[cp as keyof typeof row.cp]}</td>
                                ))}

                                {/* KL Columns */}
                                <td className={`${cellStyle} font-bold`}>{row.kl.basic}</td>
                                <td className={`${cellStyle} font-bold`}>{row.kl.average}</td>
                                <td className={`${cellStyle} font-bold`}>{row.kl.profound}</td>

                                {/* Format Columns */}
                                <td className={cellStyle}>{row.fmt.SR1}</td>
                                <td className={cellStyle}>{row.fmt.SR2}</td>
                                <td className={cellStyle}>{row.fmt.CRS1}</td>
                                <td className={cellStyle}>{row.fmt.CRS2}</td>
                                <td className={cellStyle}>{row.fmt.CRL}</td>

                                {!row.isChoiceB && (
                                    <>
                                        <td rowSpan={row.isChoiceA ? 2 : 1} className={`${cellStyle} font-bold bg-transparent`}>{row.items}</td>
                                        <td rowSpan={row.isChoiceA ? 2 : 1} className={`${cellStyle} font-black bg-transparent`}>{formatMark(row.score)}</td>
                                        <td rowSpan={row.isChoiceA ? 2 : 1} className={cellStyle}>{row.time}</td>
                                    </>
                                )}
                            </tr>
                        ))}

                        {/* Total Item Row */}
                        <tr className="bg-transparent font-bold" style={{ height: '36px' }}>
                            <td colSpan={4} className="border border-black p-2.5 text-center font-bold" style={{ fontSize: '12px' }}>Total Item</td>
                            
                            {/* CP Item Totals */}
                            {['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7'].map(cp => (
                                <td key={cp} className="border border-black p-2.5 text-center english-font text-[12px] font-bold">
                                    {columnTotals.counts.cp[cp as keyof typeof columnTotals.counts.cp] || ''}
                                </td>
                            ))}

                            {/* Level Item Totals */}
                            {['B', 'A', 'P'].map(kl => (
                                <td key={kl} className="border border-black p-2.5 text-center english-font text-[12px] font-bold">
                                    {columnTotals.counts.levels[kl as keyof typeof columnTotals.counts.levels] || ''}
                                </td>
                            ))}

                            {/* Format Item Totals */}
                            {['SR1', 'SR2', 'CRS1', 'CRS2', 'CRL'].map(fmt => (
                                <td key={fmt} className="border border-black p-2.5 text-center english-font text-[12px] font-bold">
                                    {columnTotals.counts.formats[fmt as keyof typeof columnTotals.counts.formats] || ''}
                                </td>
                            ))}

                            {/* Total Item Grand Total */}
                            <td className="border border-black p-2.5 text-center english-font text-[12px] font-bold">
                                {columnTotals.grandItems || ''}
                            </td>

                            {/* Total Score cell is empty in Total Item row */}
                            <td className="border border-black bg-transparent"></td>

                            {/* Answering Time Grand Total */}
                            <td className="border border-black p-2.5 text-center english-font text-[12px] font-bold">
                                {columnTotals.grandTime || ''}
                            </td>
                        </tr>

                        {/* Total Score Row */}
                        <tr className="bg-transparent font-bold" style={{ height: '36px' }}>
                            <td colSpan={4} className="border border-black p-2.5 text-center font-bold" style={{ fontSize: '12px' }}>Total Score</td>
                            
                            {/* CP Score Totals */}
                            {['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7'].map(cp => (
                                <td key={cp} className="border border-black p-2.5 text-center english-font text-[12px] font-bold">
                                    {columnTotals.scores.cp[cp as keyof typeof columnTotals.scores.cp] || ''}
                                </td>
                            ))}

                            {/* Level Score Totals */}
                            {['B', 'A', 'P'].map(kl => (
                                <td key={kl} className="border border-black p-2.5 text-center english-font text-[12px] font-bold">
                                    {columnTotals.scores.levels[kl as keyof typeof columnTotals.scores.levels] || ''}
                                </td>
                            ))}

                            {/* Format Score Totals */}
                            {['SR1', 'SR2', 'CRS1', 'CRS2', 'CRL'].map(fmt => (
                                <td key={fmt} className="border border-black p-2.5 text-center english-font text-[12px] font-bold">
                                    {columnTotals.scores.formats[fmt as keyof typeof columnTotals.scores.formats] || ''}
                                </td>
                            ))}

                            {/* Total Item cell is blacked out / empty in Total Score row */}
                            <td className="border border-black" style={{ backgroundColor: '#000000' }}></td>

                            {/* Total Score Grand Total */}
                            <td className="border border-black p-2.5 text-center english-font text-[12px] font-black">
                                {formatMark(columnTotals.grandScore)}
                            </td>

                            {/* Answering Time cell is empty in Total Score row */}
                            <td className="border border-black bg-transparent"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .report-page {
                        box-shadow: none !important;
                        margin: 0 !important;
                        width: 100% !important;
                        min-height: 0 !important;
                        page-break-after: auto !important;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                    }
                    table {
                        page-break-inside: auto !important;
                    }
                    .tamil-font {
                        font-size: 8pt !important;
                        line-height: 1.1 !important;
                    }
                }
            ` }} />
        </div>
    );
};
