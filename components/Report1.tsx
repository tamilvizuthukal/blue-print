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
                <div className="mb-6 avoid-break font-serif">
                    <h3 className="text-[11pt] font-bold mb-1 text-black">I. Weightage to Content Area</h3>
                    <table className="w-full border-collapse border border-black text-sm table-fixed">
                        <thead>
                            <tr className="bg-transparent">
                                <th className="border border-black p-1.5 w-[6%] font-bold text-center">Sl. No.</th>
                                <th className="border border-black p-1.5 w-[34%] font-bold text-left">Learning Objective</th>
                                <th className="border border-black p-1.5 w-[22%] font-bold text-left">Unit / Topic / Chapter</th>
                                <th className="border border-black p-1.5 w-[22%] font-bold text-left">Sub-unit / Sub-topic / Discourse</th>
                                <th className="border border-black p-1.5 w-[8%] font-bold text-center">Score</th>
                                <th className="border border-black p-1.5 w-[8%] font-bold text-center">Percentage</th>
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
                            <tr className="bg-transparent font-bold">
                                <td colSpan={4} className="border border-black p-1.5 text-center uppercase tracking-widest">Total</td>
                                <td className="border border-black p-1.5 text-center">{formatMark(blueprint.totalMarks)}</td>
                                <td className="border border-black p-1.5 text-center english-font">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* II. Cognitive Process */}
                <div className="mb-6 avoid-break font-serif">
                    <h3 className="text-[11pt] font-bold mb-1 text-black">II. Weightage to Cognitive Process</h3>
                    <table className="w-full border-collapse border border-black text-sm table-fixed">
                        <thead>
                            <tr className="bg-transparent">
                                <th className="border border-black p-1.5 w-[15%] text-center font-bold">Sl. No.</th>
                                <th className="border border-black p-1.5 text-left w-[45%] font-bold">Cognitive Process</th>
                                <th className="border border-black p-1.5 w-[20%] text-center font-bold">Score</th>
                                <th className="border border-black p-1.5 w-[20%] text-center font-bold">Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cpWeightage.map((row, idx) => {
                                const subscript = ['₁', '₂', '₃', '₄', '₅', '₆', '₇'][idx] || `${idx + 1}`;
                                return (
                                    <tr key={idx}>
                                        <td className="border border-black p-1.5 text-center font-bold english-font">CP{subscript}</td>
                                        <td className="border border-black p-1.5 text-left text-[11px] font-normal">{row.label}</td>
                                        <td className="border border-black p-1.5 text-center font-bold">{row.score ? formatMark(row.score) : '-'}</td>
                                        <td className="border border-black p-1.5 text-center english-font">{row.pct || '-'}</td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-transparent font-black">
                                <td colSpan={2} className="border border-black p-1.5 text-center uppercase">Total</td>
                                <td className="border border-black p-1.5 text-center"></td>
                                <td className="border border-black p-1.5 text-center english-font">100%</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="text-[11px] mt-1 text-black italic">Index of Abbreviation: CP - Cognitive Process</div>
                </div>

                {/* III. Knowledge Level */}
                <div className="mb-6 avoid-break font-serif">
                    <h3 className="text-[11pt] font-bold mb-1 text-black">III. Weightage to Knowledge Level</h3>
                    <table className="w-full border-collapse border border-black text-sm table-fixed">
                        <thead>
                            <tr className="bg-transparent">
                                <th className="border border-black p-1.5 w-[15%] text-center font-bold">Sl. No.</th>
                                <th className="border border-black p-1.5 text-left w-[45%] font-bold">Knowledge Level</th>
                                <th className="border border-black p-1.5 w-[20%] text-center font-bold">Score</th>
                                <th className="border border-black p-1.5 w-[20%] text-center font-bold">Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {['Basic', 'Average', 'Profound'].map((level, idx) => {
                                const stats = klWeightage[level as keyof typeof klWeightage] || { count: 0, score: 0 };
                                const score = stats.score;
                                const pct = blueprint.totalMarks > 0 ? ((score / blueprint.totalMarks) * 100).toFixed(0) : '0';
                                return (
                                    <tr key={level}>
                                        <td className="border border-black p-1.5 text-center english-font">{idx + 1}</td>
                                        <td className="border border-black p-1.5 text-left font-bold">{level}</td>
                                        <td className="border border-black p-1.5 text-center font-bold">{score ? formatMark(score) : '-'}</td>
                                        <td className="border border-black p-1.5 text-center english-font">{pct}%</td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-transparent font-black">
                                <td colSpan={2} className="border border-black p-1.5 text-center uppercase">Total</td>
                                <td className="border border-black p-1.5 text-center font-bold">{formatMark(blueprint.totalMarks)}</td>
                                <td className="border border-black p-1.5 text-center english-font">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* IV. Item Format */}
                <div className="mb-6 avoid-break font-serif">
                    <h3 className="text-[11pt] font-bold mb-1 text-black">IV. Weightage to Item Format</h3>
                    <table className="w-full border-collapse border border-black text-sm table-fixed">
                        <thead>
                            <tr className="bg-transparent">
                                <th className="border border-black p-1.5 w-[8%] font-bold text-center" rowSpan={2}>Sl. No.</th>
                                <th className="border border-black p-1.5 w-[38%] font-bold text-center" colSpan={3}>Item Format</th>
                                <th className="border border-black p-1.5 w-[14%] font-bold text-center" rowSpan={2}>No. of Items</th>
                                <th className="border border-black p-1.5 w-[14%] font-bold text-center" rowSpan={2}>Estimated Time</th>
                                <th className="border border-black p-1.5 w-[14%] font-bold text-center" rowSpan={2}>Score allotted</th>
                                <th className="border border-black p-1.5 w-[12%] font-bold text-center" rowSpan={2}>Percentage</th>
                            </tr>
                            <tr className="bg-transparent text-[1px] leading-[1px]">
                                <th className="border border-black p-0 h-0" style={{ width: '15%' }}></th>
                                <th className="border border-black p-0 h-0" style={{ width: '13%' }}></th>
                                <th className="border border-black p-0 h-0" style={{ width: '10%' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const sr1 = formatWeightage.SR1 || { count: 0, time: 0, score: 0 };
                                const sr2 = formatWeightage.SR2 || { count: 0, time: 0, score: 0 };
                                const crs1 = formatWeightage.CRS1 || { count: 0, time: 0, score: 0 };
                                const crs2 = formatWeightage.CRS2 || { count: 0, time: 0, score: 0 };
                                const crl = formatWeightage.CRL || { count: 0, time: 0, score: 0 };

                                const totalCount = (sr1.count || 0) + (sr2.count || 0) + (crs1.count || 0) + (crs2.count || 0) + (crl.count || 0);
                                const totalTime = (sr1.time || 0) + (sr2.time || 0) + (crs1.time || 0) + (crs2.time || 0) + (crl.time || 0);
                                const totalScore = (sr1.score || 0) + (sr2.score || 0) + (crs1.score || 0) + (crs2.score || 0) + (crl.score || 0);

                                const getPct = (score: number) => {
                                    return blueprint.totalMarks > 0 ? ((score / blueprint.totalMarks) * 100).toFixed(0) : '0';
                                };

                                const formatVal = (val: number | string) => {
                                    if (!val || val === 0) return '-';
                                    return val;
                                };

                                return (
                                    <>
                                        {/* Row 1: SR1 */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold english-font text-xs" rowSpan={2}>1</td>
                                            <td className="border border-black p-1 text-left font-bold text-xs" rowSpan={2}>SR Item</td>
                                            <td className="border border-black p-1 text-center font-bold text-xs">SR₁</td>
                                            <td className="border border-black p-1 text-center text-xs">MCI</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{formatVal(sr1.count)}</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{formatVal(sr1.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold text-xs">{sr1.score ? formatMark(sr1.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{sr1.score > 0 ? `${getPct(sr1.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 2: SR2 */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold text-xs">SR₂</td>
                                            <td className="border border-black p-1 text-center text-xs">MI</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{formatVal(sr2.count)}</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{formatVal(sr2.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold text-xs">{sr2.score ? formatMark(sr2.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{sr2.score > 0 ? `${getPct(sr2.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 3: CRS1 */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold english-font text-xs" rowSpan={2}>2</td>
                                            <td className="border border-black p-1 text-left font-bold text-xs" rowSpan={2}>CRS Item</td>
                                            <td className="border border-black p-1 text-center font-bold text-xs">CRS₁</td>
                                            <td className="border border-black p-1 text-center text-xs">VSA</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{formatVal(crs1.count)}</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{formatVal(crs1.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold text-xs">{crs1.score ? formatMark(crs1.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{crs1.score > 0 ? `${getPct(crs1.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 4: CRS2 */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold text-xs">CRS₂</td>
                                            <td className="border border-black p-1 text-center text-xs">SA</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{formatVal(crs2.count)}</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{formatVal(crs2.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold text-xs">{crs2.score ? formatMark(crs2.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{crs2.score > 0 ? `${getPct(crs2.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 5: CRL */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold english-font text-xs">3</td>
                                            <td className="border border-black p-1 text-left font-bold text-xs">CRL Item</td>
                                            <td className="border border-black p-1 text-center font-bold text-xs">CRL</td>
                                            <td className="border border-black p-1 text-center text-xs">E</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{formatVal(crl.count)}</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{formatVal(crl.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold text-xs">{crl.score ? formatMark(crl.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center english-font text-xs">{crl.score > 0 ? `${getPct(crl.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Total Row */}
                                        <tr className="bg-transparent font-black">
                                            <td colSpan={4} className="border border-black p-1.5 text-center uppercase">Total</td>
                                            <td className="border border-black p-1.5 text-center english-font">{totalCount || '-'}</td>
                                            <td className="border border-black p-1.5 text-center english-font">{totalTime || '-'}</td>
                                            <td className="border border-black p-1.5 text-center">{formatMark(totalScore)}</td>
                                            <td className="border border-black p-1.5 text-center english-font">100%</td>
                                        </tr>
                                    </>
                                );
                            })()}
                        </tbody>
                    </table>
                    <div className="text-[11px] mt-2 text-black font-serif leading-relaxed">
                        <div className="font-bold mb-1">Index of Abbreviations:</div>
                        <div className="grid grid-cols-2 gap-x-8 max-w-lg">
                            <div>
                                <span className="font-bold w-[40px] inline-block">SR</span> - Selected Response<br />
                                <span className="font-bold w-[40px] inline-block">CRS</span> - Constructed Response Short Answer<br />
                                <span className="font-bold w-[40px] inline-block">CRL</span> - Constructed Response Long Answer<br />
                                <span className="font-bold w-[40px] inline-block">MCI</span> - Multiple Choice Items<br />
                                <span className="font-bold w-[40px] inline-block">MI</span> - Matching Item
                            </div>
                            <div>
                                <span className="font-bold w-[40px] inline-block">VSA</span> - Very Short Answer<br />
                                <span className="font-bold w-[40px] inline-block">SA</span> - Short Answer<br />
                                <span className="font-bold w-[40px] inline-block">E</span> - Essay
                            </div>
                        </div>
                    </div>
                </div>

                {/* V & VI */}
                <div className="avoid-break border-t border-black pt-4 mt-6 font-serif text-[11pt]">
                    {/* V. Scheme of Sections */}
                    <div className="mb-4">
                        <h3 className="font-bold text-black">V. Scheme of Sections :</h3>
                    </div>

                    {/* VI. Pattern of Options */}
                    <div className="flex gap-4">
                        <div className="font-bold text-black w-[180px]">VI. Pattern of Options :</div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-4">
                                <span className="w-[120px]">Internal choice</span>
                                <div style={{
                                    border: '1.5px solid #000',
                                    width: '20px',
                                    height: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '10pt'
                                }}>
                                    {blueprint.items.some(i => i.hasInternalChoice) ? '✓' : ''}
                                </div>
                                <span className="text-sm font-medium">33 – 35%</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="w-[120px]">Overall choice</span>
                                <div style={{
                                    border: '1.5px solid #000',
                                    width: '20px',
                                    height: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                </div>
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
