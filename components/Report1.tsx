import React from 'react';
import { Blueprint } from '../types';
import { ReportHeader } from './reports/ReportHeader';
import { formatMark } from '../services/reportUtils';
import { ReportData } from '../hooks/useReportData';

interface Report1Props {
    blueprint: Blueprint;
    data: ReportData;
}

/**
 * Report1: Question Paper Analysis Report
 * 
 * Features:
 * - Unified rendering for Print and Export
 * - Continuous table flow with repeating headers
 * - Grapheme-aware Tamil wrapping
 */
export const Report1: React.FC<Report1Props> = ({ blueprint, data }) => {
    const { contentAreaRows, cpWeightage, klWeightage, formatWeightage } = data;

    return (
        <div className="report1-container w-full">
            <div className="report-page bg-white p-[15mm] print:p-0 text-black shadow-lg mx-auto mb-8 relative" 
                 style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}>
                
                <ReportHeader blueprint={blueprint} sectionTitle="PART – III : QUESTION PAPER DESIGN" />
                
                {/* Section I: Weightage to Content Area */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold mb-2 uppercase border-b border-black pb-1">I. Weightage to Content Area</h3>
                    <table className="w-full border-collapse border border-black text-sm table-fixed">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-2 w-[6%] font-bold">Sl</th>
                                <th className="border border-black p-2 w-[34%] font-bold text-left">Learning Objective</th>
                                <th className="border border-black p-2 w-[22%] font-bold text-left">Unit / Topic</th>
                                <th className="border border-black p-2 w-[22%] font-bold text-left">Sub-unit / Discourse</th>
                                <th className="border border-black p-2 w-[8%] font-bold">Score</th>
                                <th className="border border-black p-2 w-[8%] font-bold">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contentAreaRows.map((row, idx) => (
                                <tr key={idx}>
                                    <td className="border border-black p-1.5 text-center english-font">{idx + 1}</td>
                                    <td className="border border-black p-1.5 text-left text-[11px] leading-tight tamil-font" style={{ wordBreak: 'normal', overflowWrap: 'break-word' }}>
                                        {row.learningObjective}
                                    </td>
                                    <td className="border border-black p-1.5 text-left text-[11px] font-bold tamil-font" style={{ wordBreak: 'normal', overflowWrap: 'break-word' }}>
                                        {row.unitNumber}. {row.unit}
                                    </td>
                                    <td className="border border-black p-1.5 text-left text-[10px] italic leading-tight tamil-font" style={{ wordBreak: 'normal', overflowWrap: 'break-word' }}>
                                        {row.discourses}
                                    </td>
                                    <td className="border border-black p-1.5 text-center font-bold">{formatMark(row.score)}</td>
                                    <td className="border border-black p-1.5 text-center english-font text-[11px]">{row.pct}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-50 font-bold">
                                <td colSpan={4} className="border border-black p-2 text-center uppercase tracking-widest">Total</td>
                                <td className="border border-black p-2 text-center">{formatMark(blueprint.totalMarks)}</td>
                                <td className="border border-black p-2 text-center english-font">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* II. Cognitive Process */}
                <div className="mb-6 avoid-break">
                    <h3 className="text-md font-bold mb-1 uppercase border-b border-black pb-0.5">II. Weightage to Cognitive Process</h3>
                    <table className="w-full border-collapse border border-black text-sm table-fixed">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-1.5 w-[10%]">Sl. No.</th>
                                <th className="border border-black p-1.5 text-left w-[50%]">Cognitive Process</th>
                                <th className="border border-black p-1.5 w-[20%]">Score</th>
                                <th className="border border-black p-1.5 w-[20%]">Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cpWeightage.map((row, idx) => (
                                <tr key={idx}>
                                    <td className="border border-black p-1.5 text-center font-bold english-font">CP{idx + 1}</td>
                                    <td className="border border-black p-1.5 text-left text-[11px]">{row.label}</td>
                                    <td className="border border-black p-1.5 text-center font-bold">{row.score ? formatMark(row.score) : '-'}</td>
                                    <td className="border border-black p-1.5 text-center english-font">{row.pct}%</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-50 font-black">
                                <td colSpan={2} className="border border-black p-1.5 text-center uppercase">Total</td>
                                <td className="border border-black p-1.5 text-center">{formatMark(blueprint.totalMarks)}</td>
                                <td className="border border-black p-1.5 text-center english-font">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* III. Knowledge Level */}
                <div className="mb-6 avoid-break">
                    <h3 className="text-md font-bold mb-1 uppercase border-b border-black pb-0.5">III. Weightage to Knowledge Level</h3>
                    <table className="w-full border-collapse border border-black text-sm table-fixed">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-1.5 w-[10%]">Sl. No.</th>
                                <th className="border border-black p-1.5 text-left w-[50%]">Knowledge Level</th>
                                <th className="border border-black p-1.5 w-[20%]">Score</th>
                                <th className="border border-black p-1.5 w-[20%]">Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {['Basic', 'Average', 'Profound'].map((level, idx) => {
                                const score = klWeightage[level as keyof typeof klWeightage];
                                const isDraft = blueprint.items.some(i => i.hasInternalChoice);
                                const totalPossible = blueprint.totalMarks * (isDraft ? 2 : 1);
                                const pct = totalPossible > 0 ? ((score / totalPossible) * 100).toFixed(0) : '0';
                                return (
                                    <tr key={level}>
                                        <td className="border border-black p-1.5 text-center english-font">{idx + 1}</td>
                                        <td className="border border-black p-1.5 text-left font-bold">{level}</td>
                                        <td className="border border-black p-1.5 text-center font-bold">{score ? formatMark(score) : '-'}</td>
                                        <td className="border border-black p-1.5 text-center english-font">{pct}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* IV. Item Format */}
                <div className="mb-6 avoid-break">
                    <h3 className="text-md font-bold mb-1 uppercase border-b border-black pb-0.5">IV. Weightage to Item Format</h3>
                    <table className="w-full border-collapse border border-black text-sm table-fixed">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-1.5 w-[8%] font-bold">Sl</th>
                                <th className="border border-black p-1.5 text-left font-bold w-[34%]">Item Format</th>
                                <th className="border border-black p-1.5 w-[10%] font-bold">Code</th>
                                <th className="border border-black p-1.5 w-[15%] font-bold">No. of Items</th>
                                <th className="border border-black p-1.5 w-[15%] font-bold">Time (min)</th>
                                <th className="border border-black p-1.5 w-[10%] font-bold">Score</th>
                                <th className="border border-black p-1.5 w-[8%] font-bold">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { label: 'SR Item (MCI)', code: 'SR1' },
                                { label: 'SR Item (Matching)', code: 'SR2' },
                                { label: 'CRS Item (VSA)', code: 'CRS1' },
                                { label: 'CRS Item (SA)', code: 'CRS2' },
                                { label: 'CRL Item (Essay)', code: 'CRL' },
                            ].map((fmt, idx) => {
                                const stats = formatWeightage[fmt.code as keyof typeof formatWeightage] || { count: 0, time: 0, score: 0 };
                                const totalMarks = blueprint.totalMarks * (blueprint.items.some(i => i.hasInternalChoice) ? 2 : 1);
                                const pct = totalMarks > 0 ? ((stats.score / totalMarks) * 100).toFixed(0) : '0';
                                return (
                                    <tr key={fmt.code}>
                                        <td className="border border-black p-1.5 text-center english-font">{idx + 1}</td>
                                        <td className="border border-black p-1.5 text-left font-bold">{fmt.label}</td>
                                        <td className="border border-black p-1.5 text-center font-black english-font">{fmt.code}</td>
                                        <td className="border border-black p-1.5 text-center english-font">{stats.count || '-'}</td>
                                        <td className="border border-black p-1.5 text-center english-font">{stats.time || '-'}</td>
                                        <td className="border border-black p-1.5 text-center font-bold">{stats.score ? formatMark(stats.score) : '-'}</td>
                                        <td className="border border-black p-1.5 text-center english-font">{stats.score > 0 ? `${pct}%` : '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* V & VI */}
                <div className="grid grid-cols-2 gap-8 avoid-break border-t border-black pt-4">
                    <div>
                        <h3 className="text-md font-black mb-1 uppercase tracking-wider">V. Scheme of Sections</h3>
                        <p className="text-[11px] leading-relaxed italic text-gray-700">Detailed as per the official question paper structure. Continuous assessment and internal choices are factored into the score analysis.</p>
                    </div>
                    <div>
                        <h3 className="text-md font-black mb-1 uppercase tracking-wider">VI. Pattern of Options</h3>
                        <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between border-b border-gray-100 py-1">
                                <span>Internal Choice:</span>
                                <span className="font-bold english-font text-blue-700">{blueprint.items.some(i => i.hasInternalChoice) ? 'ENABLED' : 'NONE'}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 py-1">
                                <span>Overall Choice:</span>
                                <span className="font-bold english-font">FIXED</span>
                            </div>
                        </div>
                    </div>
                </div>
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
                    .avoid-break {
                        page-break-inside: avoid !important;
                    }
                }
            ` }} />
        </div>
    );
};
