import React from 'react';
import { Blueprint } from '../types';
import { ReportHeader } from './reports/ReportHeader';
import { formatMark } from '../services/reportUtils';
import { ReportData } from '../hooks/useReportData';

interface Report3Props {
    blueprint: Blueprint;
    data: ReportData;
}

/**
 * Report3: Blueprint Matrix (Content Area Analysis)
 * 
 * Features:
 * - Unified formatting matching specific requirements
 * - Continuous table flow for Landscape Matrix
 * - Repeating headers
 * - Explicit column widths via colgroup to prevent vertical text wrapping
 */
export const Report3: React.FC<Report3Props> = ({ blueprint, data }) => {
    const { matrixRows } = data;

    // Aggregate totals for the bottom row
    const totals = matrixRows.reduce((acc, row) => {
        acc.time += row.time;
        acc.items += row.items;
        acc.score += row.score;
        return acc;
    }, { time: 0, items: 0, score: 0 });

    const narrowThStyle: React.CSSProperties = {
        padding: '2px 1px',
        textAlign: 'center',
        verticalAlign: 'middle',
        fontSize: '8pt',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        fontFamily: "'Times New Roman', serif",
    };

    const narrowTdStyle: React.CSSProperties = {
        padding: '2px 1px',
        textAlign: 'center',
        verticalAlign: 'middle',
        fontSize: '8pt',
        fontFamily: "'Times New Roman', serif",
    };

    const contentCellStyle: React.CSSProperties = {
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        verticalAlign: 'top',
        padding: '3px 4px',
        fontSize: '9pt',
        fontFamily: "'TAU-Paalai', 'Latha', serif",
    };

    return (
        <div className="report3-container w-full">
            <div className="report-page bg-white p-[15mm] print:p-0 text-black shadow-lg mx-auto relative landscape" 
                 style={{ width: '297mm', minHeight: '210mm', boxSizing: 'border-box' }}>
                
                <ReportHeader blueprint={blueprint} sectionTitle="PART – I : BLUEPRINT MATRIX (CONTENT AREA ANALYSIS)" orientation="landscape" />

                <table className="w-full border-collapse border-2 border-black mt-4" 
                       style={{ tableLayout: 'fixed', width: '100%', fontSize: '9pt' }}>
                    <colgroup>
                        <col style={{ width: '75px' }} />   {/* Unit / Topic */}
                        <col style={{ width: '150px' }} />  {/* Learning Objective */}
                        <col style={{ width: '70px' }} />   {/* Sub Topic */}
                        {/* CP1–CP7 */}
                        <col style={{ width: '32px' }} />
                        <col style={{ width: '32px' }} />
                        <col style={{ width: '32px' }} />
                        <col style={{ width: '32px' }} />
                        <col style={{ width: '32px' }} />
                        <col style={{ width: '32px' }} />
                        <col style={{ width: '32px' }} />
                        {/* B, A, P */}
                        <col style={{ width: '32px' }} />
                        <col style={{ width: '32px' }} />
                        <col style={{ width: '32px' }} />
                        {/* SR1, SR2, CRS1, CRS2, CRL */}
                        <col style={{ width: '36px' }} />
                        <col style={{ width: '36px' }} />
                        <col style={{ width: '36px' }} />
                        <col style={{ width: '36px' }} />
                        <col style={{ width: '36px' }} />
                        {/* Time, Items, Score */}
                        <col style={{ width: '36px' }} />
                        <col style={{ width: '36px' }} />
                        <col style={{ width: '36px' }} />
                    </colgroup>
                    <thead>
                        <tr className="bg-emerald-50">
                            <th colSpan={3} className="border border-black p-1 text-[9px]">Content Area</th>
                            <th colSpan={7} className="border border-black p-1 text-[9px]">Cognitive Process</th>
                            <th colSpan={3} className="border border-black p-1 text-[9px]">Level</th>
                            <th colSpan={5} className="border border-black p-1 text-[9px]">Item Format</th>
                            <th rowSpan={2} className="border border-black" style={narrowThStyle}>Time</th>
                            <th rowSpan={2} className="border border-black" style={narrowThStyle}>Items</th>
                            <th rowSpan={2} className="border border-black" style={narrowThStyle}>Score</th>
                        </tr>
                        <tr className="bg-amber-50">
                            <th className="border border-black p-1 text-[8pt] font-bold">Unit / Topic</th>
                            <th className="border border-black p-1 text-[8pt] font-normal" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>Learning Objective</th>
                            <th className="border border-black p-1 text-[8pt] font-normal">Sub Topic</th>
                            
                            {['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7'].map(cp => (
                                <th key={cp} className="border border-black" style={narrowThStyle}>{cp}</th>
                            ))}
                            {['B', 'A', 'P'].map(kl => (
                                <th key={kl} className="border border-black" style={narrowThStyle}>{kl}</th>
                            ))}
                            {['SR1', 'SR2', 'CRS1', 'CRS2', 'CRL'].map(fmt => (
                                <th key={fmt} className="border border-black" style={narrowThStyle}>{fmt}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matrixRows.map((row, idx) => {
                            const stats = row.stats;
                            return (
                                <tr key={idx} className="bg-white">
                                    <td className="border border-black p-1 text-left font-bold tamil-font" style={{ fontSize: '8pt', wordBreak: 'break-word' }}>{row.unitNumber}. {row.unit}</td>
                                    <td className="border border-black" style={contentCellStyle}>{row.learningObjective}</td>
                                    <td className="border border-black p-1 text-left italic tamil-font" style={{ fontSize: '8pt', wordBreak: 'break-word' }}>{row.subTopic}</td>
                                    
                                    {/* CP Stats */}
                                    {['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7'].map(cp => (
                                        <td key={cp} className="border border-black" style={narrowTdStyle}>
                                            {stats.cp[cp].score > 0 ? <>{stats.cp[cp].count}<br />({formatMark(stats.cp[cp].score)})</> : ''}
                                        </td>
                                    ))}

                                    {/* KL Stats */}
                                    {['B', 'A', 'P'].map(kl => (
                                        <td key={kl} className="border border-black font-bold" style={narrowTdStyle}>
                                            {stats.levels[kl].score > 0 ? <>{stats.levels[kl].count}<br />({formatMark(stats.levels[kl].score)})</> : ''}
                                        </td>
                                    ))}

                                    {/* Format Stats */}
                                    {['SR1', 'SR2', 'CRS1', 'CRS2', 'CRL'].map(fmt => (
                                        <td key={fmt} className="border border-black" style={narrowTdStyle}>
                                            {stats.formats[fmt].score > 0 ? <>{stats.formats[fmt].count}<br />({formatMark(stats.formats[fmt].score)})</> : ''}
                                        </td>
                                    ))}

                                    <td className="border border-black font-bold bg-gray-50" style={narrowTdStyle}>{row.time || ''}</td>
                                    <td className="border border-black font-bold bg-gray-50" style={narrowTdStyle}>{row.items || ''}</td>
                                    <td className="border border-black font-black bg-gray-100" style={narrowTdStyle}>{row.score ? formatMark(row.score) : ''}</td>
                                </tr>
                            );
                        })}
                        <tr className="bg-gray-100 font-black text-center uppercase tracking-widest text-[9px]">
                            <td colSpan={18} className="border border-black p-2 text-right">Grand Total</td>
                            <td className="border border-black p-1 english-font" style={narrowTdStyle}>{totals.time}</td>
                            <td className="border border-black p-1 english-font" style={narrowTdStyle}>{totals.items}</td>
                            <td className="border border-black p-1" style={narrowTdStyle}>{formatMark(totals.score)}</td>
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
