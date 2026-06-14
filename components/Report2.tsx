import React from 'react';
import { Blueprint } from '../types';
import { ReportHeader } from './reports/ReportHeader';
import { formatMark } from '../services/reportUtils';
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

    // Extremely optimized column widths for A4 Landscape
    const textColWidths = {
        qNo: '28px',
        lo: '330px',   // Maximum width for Learning Objective
        unit: '85px',
        subTopic: '85px'
    };
    
    // Minimal width for data columns (fits "1(10)")
    const dataColWidth = '24px';

    const cellStyle = "border border-black p-0.5 text-center english-font text-[8px]";
    const headerStyle = "border border-black p-0.5 text-center font-bold text-[8px] bg-gray-100";

    return (
        <div className="report2-container w-full">
            <div className="report-page bg-white p-[15mm] print:p-0 text-black shadow-lg mx-auto relative landscape" 
                 style={{ width: '297mm', minHeight: '210mm', boxSizing: 'border-box' }}>
                
                <ReportHeader blueprint={blueprint} sectionTitle="PART – II : ITEM-WISE ANALYSIS" orientation="landscape" />

                <table className="w-full border-collapse border-2 border-black leading-tight mt-4" style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr className="bg-gray-100">
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: textColWidths.qNo }}>Qn</th>
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: textColWidths.lo }}>Learning Objective</th>
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: textColWidths.unit }}>Unit</th>
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: textColWidths.subTopic }}>Sub Topic</th>
                            
                            <th colSpan={7} className="border border-black p-1 font-bold text-[8px]">Cognitive Process</th>
                            <th colSpan={3} className="border border-black p-1 font-bold text-[8px]">Level</th>
                            <th colSpan={5} className="border border-black p-1 font-bold text-[8px]">Format</th>
                            
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: dataColWidth }}>Items</th>
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: dataColWidth }}>Score</th>
                            <th rowSpan={2} className="border border-black p-1 font-bold text-[8px]" style={{ width: dataColWidth }}>Time</th>
                        </tr>
                        <tr className="bg-gray-50">
                            {['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7'].map(cp => <th key={cp} className={headerStyle} style={{ width: dataColWidth }}>{cp}</th>)}
                            {['B', 'A', 'P'].map(kl => <th key={kl} className={headerStyle} style={{ width: dataColWidth }}>{kl}</th>)}
                            {['SR1', 'SR2', 'CRS1', 'CRS2', 'CRL'].map(fmt => <th key={fmt} className={headerStyle} style={{ width: dataColWidth }}>{fmt}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {itemRows.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
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

                                <td className={`${cellStyle} font-bold bg-gray-100/30`}>{row.items}</td>
                                <td className={`${cellStyle} font-black bg-gray-100/30`}>{formatMark(row.score)}</td>
                                <td className={cellStyle}>{row.time}</td>
                            </tr>
                        ))}
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
