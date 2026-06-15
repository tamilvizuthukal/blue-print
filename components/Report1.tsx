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
 * - Standardized Fonts: English (Times New Roman), Tamil (TAU-Paalai)
 * - Uniform Font Size: 11pt
 */
export const Report1: React.FC<Report1Props> = ({ blueprint, data }) => {
    const { contentAreaRows, cpWeightage, klWeightage, formatWeightage } = data;

    return (
        <div className="report1-container w-full">
            <div className="report-page bg-white p-[15mm] print:p-0 text-black shadow-lg mx-auto mb-8 relative font-report" 
                 style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}>
                
                <ReportHeader blueprint={blueprint} sectionTitle="PART – III : QUESTION PAPER DESIGN" />
                
                {/* Section I: Weightage to Content Area */}
                <div className="mb-6 avoid-break">
                    <h3 className="text-[11pt] font-bold mb-1 text-black uppercase">I. Weightage to Content Area</h3>
                    <table className="w-full border-collapse border border-black text-[11pt] table-fixed">
                        <thead>
                            <tr className="bg-transparent">
                                <th className="border border-black p-1 w-[5%] font-bold text-center" rowSpan={2}>Sl. No.</th>
                                <th className="border border-black p-1 w-[29%] font-bold text-left" rowSpan={2}>Learning Objective</th>
                                <th className="border border-black p-1 w-[19%] font-bold text-left" rowSpan={2}>Unit / Topic / Chapter</th>
                                <th className="border border-black p-1 w-[19%] font-bold text-left" rowSpan={2}>Sub-unit / Sub-topic / Discourse</th>
                                <th className="border border-black p-1 w-[18%] font-bold text-center" colSpan={2}>Score</th>
                                <th className="text-[10pt] border border-black p-1 w-[10%] font-bold text-center" rowSpan={2}>Percentage</th>
                            </tr>
                            <tr className="bg-transparent">
                                <th className="text-[9pt] border border-black p-1 font-bold text-center w-[9%]">Weightage</th>
                                <th className="text-[10pt] border border-black p-1 font-bold text-center w-[9%]">Total Marks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contentAreaRows.map((row, idx) => (
                                row.subunits.map((su, suIdx) => (
                                    <tr key={`${idx}-${suIdx}`}>
                                        {suIdx === 0 && (
                                            <>
                                                <td className="border border-black p-1 text-center font-english" rowSpan={row.subunits.length}>{idx + 1}</td>
                                                <td className="text-[10pt] border border-black p-1 text-left tamil-font leading-tight" rowSpan={row.subunits.length}>
                                                    {row.learningObjective}
                                                </td>
                                                <td className="text-[10pt] border border-black p-1 text-left font-bold tamil-font leading-tight" rowSpan={row.subunits.length}>
                                                    {row.unitNumber}. {row.unit}
                                                </td>
                                            </>
                                        )}
                                        <td className="border border-black p-1 text-left italic tamil-font leading-tight">
                                            {su.name}
                                        </td>
                                        <td className="border border-black p-1 text-center font-bold font-english">
                                            {formatMark(su.score)}
                                        </td>
                                        {suIdx === 0 && (
                                            <>
                                                <td className="border border-black p-1 text-center font-bold font-english" rowSpan={row.subunits.length}>
                                                    {formatMark(row.score)}
                                                </td>
                                                <td className="border border-black p-1 text-center font-english" rowSpan={row.subunits.length}>
                                                    {row.pct}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            ))}
                            <tr className="bg-transparent font-bold">
                                <td colSpan={5} className="border border-black p-1.5 text-center uppercase tracking-widest">Total</td>
                                <td className="border border-black p-1.5 text-center font-english">{formatMark(blueprint.totalMarks)}</td>
                                <td className="border border-black p-1.5 text-center font-english">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* II. Cognitive Process */}
                <div className="mb-6 avoid-break">
                    <h3 className="text-[11pt] font-bold mb-1 text-black uppercase">II. Weightage to Cognitive Process</h3>
                    <table className="w-full border-collapse border border-black text-[11pt] table-fixed">
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
                                        <td className="border border-black p-1.5 text-center font-bold font-english">CP{subscript}</td>
                                        <td className="border border-black p-1.5 text-left">{row.label}</td>
                                        <td className="border border-black p-1.5 text-center font-bold font-english">{row.score ? formatMark(row.score) : '-'}</td>
                                        <td className="border border-black p-1.5 text-center font-english">{row.pct || '-'}%</td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-transparent font-bold">
                                <td colSpan={2} className="border border-black p-1.5 text-center uppercase tracking-widest">Total</td>
                                <td className="border border-black p-1.5 text-center font-english">{formatMark(blueprint.totalMarks)}</td>
                                <td className="border border-black p-1.5 text-center font-english">100%</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="text-[10pt] mt-1 text-black italic font-english">Index of Abbreviation: CP - Cognitive Process</div>
                </div>

                {/* III. Knowledge Level */}
                <div className="mb-6 avoid-break">
                    <h3 className="text-[11pt] font-bold mb-1 text-black uppercase">III. Weightage to Knowledge Level</h3>
                    <table className="w-full border-collapse border border-black text-[11pt] table-fixed">
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
                                        <td className="border border-black p-1.5 text-center font-english">{idx + 1}</td>
                                        <td className="border border-black p-1.5 text-left font-bold">{level}</td>
                                        <td className="border border-black p-1.5 text-center font-bold font-english">{score ? formatMark(score) : '-'}</td>
                                        <td className="border border-black p-1.5 text-center font-english">{pct}%</td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-transparent font-bold">
                                <td colSpan={2} className="border border-black p-1.5 text-center uppercase tracking-widest">Total</td>
                                <td className="border border-black p-1.5 text-center font-bold font-english">{formatMark(blueprint.totalMarks)}</td>
                                <td className="border border-black p-1.5 text-center font-english">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* IV. Item Format */}
                <div className="mb-6 avoid-break">
                    <h3 className="text-[11pt] font-bold mb-1 text-black uppercase">IV. Weightage to Item Format</h3>
                    <table className="w-full border-collapse border border-black text-[11pt] table-fixed">
                        <thead>
                            <tr className="bg-transparent">
                                <th className="border border-black p-1 w-[8%] font-bold text-center" rowSpan={2}>Sl. No.</th>
                                <th className="border border-black p-1 w-[38%] font-bold text-center" colSpan={3}>Item Format</th>
                                <th className="border border-black p-1 w-[14%] font-bold text-center" rowSpan={2}>No. of Items</th>
                                <th className="border border-black p-1 w-[14%] font-bold text-center" rowSpan={2}>Estimated Time</th>
                                <th className="border border-black p-1 w-[14%] font-bold text-center" rowSpan={2}>Score allotted</th>
                                <th className="border border-black p-1 w-[12%] font-bold text-center" rowSpan={2}>Percentage</th>
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
                                            <td className="border border-black p-1 text-center font-bold font-english" rowSpan={2}>1</td>
                                            <td className="border border-black p-1 text-left font-bold" rowSpan={2}>SR Item</td>
                                            <td className="border border-black p-1 text-center font-bold font-english">SR₁</td>
                                            <td className="border border-black p-1 text-center font-english">MCI</td>
                                            <td className="border border-black p-1 text-center font-english">{formatVal(sr1.count)}</td>
                                            <td className="border border-black p-1 text-center font-english">{formatVal(sr1.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold font-english">{sr1.score ? formatMark(sr1.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center font-english">{sr1.score > 0 ? `${getPct(sr1.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 2: SR2 */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold font-english">SR₂</td>
                                            <td className="border border-black p-1 text-center font-english">MI</td>
                                            <td className="border border-black p-1 text-center font-english">{formatVal(sr2.count)}</td>
                                            <td className="border border-black p-1 text-center font-english">{formatVal(sr2.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold font-english">{sr2.score ? formatMark(sr2.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center font-english">{sr2.score > 0 ? `${getPct(sr2.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 3: CRS1 */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold font-english" rowSpan={2}>2</td>
                                            <td className="border border-black p-1 text-left font-bold" rowSpan={2}>CRS Item</td>
                                            <td className="border border-black p-1 text-center font-bold font-english">CRS₁</td>
                                            <td className="border border-black p-1 text-center font-english">VSA</td>
                                            <td className="border border-black p-1 text-center font-english">{formatVal(crs1.count)}</td>
                                            <td className="border border-black p-1 text-center font-english">{formatVal(crs1.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold font-english">{crs1.score ? formatMark(crs1.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center font-english">{crs1.score > 0 ? `${getPct(crs1.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 4: CRS2 */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold font-english">CRS₂</td>
                                            <td className="border border-black p-1 text-center font-english">SA</td>
                                            <td className="border border-black p-1 text-center font-english">{formatVal(crs2.count)}</td>
                                            <td className="border border-black p-1 text-center font-english">{formatVal(crs2.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold font-english">{crs2.score ? formatMark(crs2.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center font-english">{crs2.score > 0 ? `${getPct(crs2.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 5: CRL */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold font-english">3</td>
                                            <td className="border border-black p-1 text-left font-bold">CRL Item</td>
                                            <td className="border border-black p-1 text-center font-bold font-english">CRL</td>
                                            <td className="border border-black p-1 text-center font-english">E</td>
                                            <td className="border border-black p-1 text-center font-english">{formatVal(crl.count)}</td>
                                            <td className="border border-black p-1 text-center font-english">{formatVal(crl.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold font-english">{crl.score ? formatMark(crl.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center font-english">{crl.score > 0 ? `${getPct(crl.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Total Row */}
                                        <tr className="bg-transparent font-bold">
                                            <td colSpan={4} className="border border-black p-1.5 text-center uppercase tracking-widest">Total</td>
                                            <td className="border border-black p-1.5 text-center font-english">{totalCount || '-'}</td>
                                            <td className="border border-black p-1.5 text-center font-english">{totalTime || '-'}</td>
                                            <td className="border border-black p-1.5 text-center font-english">{formatMark(totalScore)}</td>
                                            <td className="border border-black p-1.5 text-center font-english">100%</td>
                                        </tr>
                                    </>
                                );
                            })()}
                        </tbody>
                    </table>
                    <div className="text-[10pt] mt-2 text-black leading-relaxed font-english">
                        <div className="font-bold mb-1 uppercase tracking-wider">Index of Abbreviations:</div>
                        <div className="grid grid-cols-2 gap-x-15 max-w-xl">
                            <div>
                                <span className="font-bold w-[40px] inline-block">SR</span> -  Selected Response<br />
                                <span className="font-bold w-[40px] inline-block">CRS</span> -  Constructed Response Short Answer<br />
                                <span className="font-bold w-[40px] inline-block">CRL</span> -  Constructed Response Long Answer<br />
                                <span className="font-bold w-[40px] inline-block">MCI</span> -  Multiple Choice Items<br />
                                <span className="font-bold w-[40px] inline-block">MI</span> -  Matching Item
                            </div>
                            <div>
                                <span className="font-bold w-[40px] inline-block">VSA</span> -  Very Short Answer<br />
                                <span className="font-bold w-[40px] inline-block">SA</span> -  Short Answer<br />
                                <span className="font-bold w-[40px] inline-block">E</span> -  Essay
                            </div>
                        </div>
                    </div>
                </div>

                {/* V & VI */}
                <div className="avoid-break border-t border-black pt-4 mt-6 text-[11pt]">
                    {/* V. Scheme of Sections */}
                    <div className="mb-4">
                        <h3 className="font-bold text-black uppercase">V. Scheme of Sections :</h3>
                    </div>

                    {/* VI. Pattern of Options */}
                    <div className="flex gap-4">
                        <div className="font-bold text-black w-[180px] uppercase">VI. Pattern of Options :</div>
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
                                    fontSize: '11pt'
                                }} className="font-english">
                                    {blueprint.items.some(i => i.hasInternalChoice) ? '✓' : ''}
                                </div>
                                <span className="font-medium font-english">33 – 35%</span>
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
                .font-report {
                    font-family: 'Times New Roman', serif !important;
                }
                .tamil-font {
                    font-family: 'TAU-Paalai', serif !important;
                    font-size: 9.5pt !important;
                }
                .font-english {
                    font-family: 'Times New Roman', serif !important;
                }
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