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
 * - Uniform Font Size: 10pt (English), 10.5pt (Tamil)
 */
export const Report1: React.FC<Report1Props> = ({ blueprint, data }) => {
    const { contentAreaRows, cpWeightage, klWeightage, formatWeightage } = data;

    const settings = React.useMemo(() => {
        const defaultSettings = {
            fontFamily: 'TAU-Paalai',
            fontFamilyEnglish: 'Times New Roman',
            fontSizeTamil: 10.5,
            fontSizeEnglish: 10,
            fontSizeBody: 10,
        };

        let localSettings: any = {};
        try {
            const stored = localStorage.getItem(`bp_settings_${blueprint.id}_report1`);
            if (stored) localSettings = JSON.parse(stored);
        } catch (e) { }

        const perReport = (blueprint.perReportSettings?.report1 || {}) as any;
        const globalSettings = blueprint.reportSettings || {};

        return {
            ...defaultSettings,
            ...globalSettings,
            ...perReport,
            ...localSettings
        };
    }, [blueprint]);

    return (
        <div className="report1-container w-full">
            <div className="report-page bg-white p-[15mm] print:p-0 text-black shadow-lg mx-auto mb-8 relative font-report">
                
                <ReportHeader blueprint={blueprint} sectionTitle="PART – III : QUESTION PAPER DESIGN" />
                
                {/* Section I: Weightage to Content Area */}
                <div className="mb-6 avoid-break">
                    <h3 className="text-[10pt] font-bold mb-1 text-black uppercase">I. Weightage to Content Area</h3>
                    <table className="w-full border-collapse border border-black text-[10pt] table-fixed">
                        <thead>
                            <tr className="bg-transparent">
                                <th className="border border-black p-1 w-[5%] font-bold text-center text-[10pt]" rowSpan={2}>Sl. No.</th>
                                <th className="border border-black p-1 w-[29%] font-bold text-center text-[10pt] whitespace-normal break-words" rowSpan={2}>Learning Objective</th>
                                <th className="border border-black p-1 w-[19%] font-bold text-center text-[10pt] whitespace-normal break-words" rowSpan={2}>Unit / Topic / Chapter</th>
                                <th className="border border-black p-1 w-[19%] font-bold text-center text-[10pt] whitespace-normal break-words" rowSpan={2}>Sub-unit / Sub-topic / Discourse</th>
                                <th className="border border-black p-1 w-[18%] font-bold text-center text-[10pt]" colSpan={2}>Score</th>
                                <th className="text-[10pt] border border-black p-1 w-[10%] font-bold text-center whitespace-normal break-words" rowSpan={2}>Percentage</th>
                            </tr>
                            <tr className="bg-transparent">
                                <th className="text-[10pt] border border-black p-1 font-bold text-center w-[9%] whitespace-normal break-words">Weightage</th>
                                <th className="text-[10pt] border border-black p-1 font-bold text-center w-[9%] whitespace-normal break-words">Total Marks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contentAreaRows.map((row, idx) => (
                                row.subunits.map((su, suIdx) => (
                                    <tr key={`${idx}-${suIdx}`}>
                                        {suIdx === 0 && (
                                            <>
                                                <td className="border border-black p-1 text-center font-english text-[10pt]" rowSpan={row.subunits.length}>{idx + 1}</td>
                                                <td className="text-[10.5pt] border border-black p-1 text-left tamil-font leading-tight" rowSpan={row.subunits.length}>
                                                    {row.learningObjective}
                                                </td>
                                                <td className="text-[10.5pt] border border-black p-1 text-left font-bold tamil-font leading-tight" rowSpan={row.subunits.length}>
                                                    {row.unitNumber}. {row.unit}
                                                </td>
                                            </>
                                        )}
                                        <td className="border border-black p-1 text-left italic tamil-font leading-tight text-[10.5pt]">
                                            {su.name}
                                        </td>
                                        <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">
                                            {formatMark(su.score)}
                                        </td>
                                        {suIdx === 0 && (
                                            <>
                                                <td className="border border-black p-1 text-center font-bold font-english text-[10pt]" rowSpan={row.subunits.length}>
                                                    {formatMark(row.score)}
                                                </td>
                                                <td className="border border-black p-1 text-center font-english text-[10pt]" rowSpan={row.subunits.length}>
                                                    {row.pct}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            ))}
                            <tr className="bg-transparent font-bold">
                                <td colSpan={5} className="border border-black p-1.5 text-center uppercase tracking-widest text-[10pt]">Total</td>
                                <td className="border border-black p-1.5 text-center font-english text-[10pt]">{formatMark(blueprint.totalMarks)}</td>
                                <td className="border border-black p-1.5 text-center font-english text-[10pt]">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* II. Cognitive Process */}
                <div className="mb-6 avoid-break">
                    <h3 className="text-[10pt] font-bold mb-1 text-black uppercase">II. Weightage to Cognitive Process</h3>
                    <table className="w-full border-collapse border border-black text-[10pt] table-fixed">
                        <thead>
                            <tr className="bg-transparent">
                                <th className="border border-black p-1.5 w-[15%] text-center font-bold text-[10pt]">Sl. No.</th>
                                <th className="border border-black p-1.5 text-center w-[45%] font-bold text-[10pt]">Cognitive Process</th>
                                <th className="border border-black p-1.5 w-[20%] text-center font-bold text-[10pt]">Score</th>
                                <th className="border border-black p-1.5 w-[20%] text-center font-bold text-[10pt]">Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cpWeightage.map((row, idx) => {
                                const subscript = ['₁', '₂', '₃', '₄', '₅', '₆', '₇'][idx] || `${idx + 1}`;
                                return (
                                    <tr key={idx}>
                                        <td className="border border-black p-1.5 text-center font-bold font-english text-[10pt]">CP{subscript}</td>
                                        <td className="border border-black p-1.5 text-left text-[10pt]">{row.label}</td>
                                        <td className="border border-black p-1.5 text-center font-bold font-english text-[10pt]">{row.score ? formatMark(row.score) : '-'}</td>
                                        <td className="border border-black p-1.5 text-center font-english text-[10pt]">{row.pct || '-'}%</td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-transparent font-bold">
                                <td colSpan={2} className="border border-black p-1.5 text-center uppercase tracking-widest text-[10pt]">Total</td>
                                <td className="border border-black p-1.5 text-center font-english text-[10pt]">{formatMark(blueprint.totalMarks)}</td>
                                <td className="border border-black p-1.5 text-center font-english text-[10pt]">100%</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="text-[10pt] mt-1 text-black italic font-english">Index of Abbreviation: CP - Cognitive Process</div>
                </div>

                {/* III. Knowledge Level */}
                <div className="mb-6 avoid-break">
                    <h3 className="text-[10pt] font-bold mb-1 text-black uppercase">III. Weightage to Knowledge Level</h3>
                    <table className="w-full border-collapse border border-black text-[10pt] table-fixed">
                        <thead>
                            <tr className="bg-transparent">
                                <th className="border border-black p-1.5 w-[15%] text-center font-bold text-[10pt]">Sl. No.</th>
                                <th className="border border-black p-1.5 text-center w-[45%] font-bold text-[10pt]">Knowledge Level</th>
                                <th className="border border-black p-1.5 w-[20%] text-center font-bold text-[10pt]">Score</th>
                                <th className="border border-black p-1.5 w-[20%] text-center font-bold text-[10pt]">Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {['Basic', 'Average', 'Profound'].map((level, idx) => {
                                const stats = klWeightage[level as keyof typeof klWeightage] || { count: 0, score: 0 };
                                const score = stats.score;
                                const pct = blueprint.totalMarks > 0 ? ((score / blueprint.totalMarks) * 100).toFixed(0) : '0';
                                return (
                                    <tr key={level}>
                                        <td className="border border-black p-1.5 text-center font-english text-[10pt]">{idx + 1}</td>
                                        <td className="border border-black p-1.5 text-left font-bold text-[10pt]">{level}</td>
                                        <td className="border border-black p-1.5 text-left font-bold font-english text-[10pt]">{score ? formatMark(score) : '-'}</td>
                                        <td className="border border-black p-1.5 text-left font-english text-[10pt]">{pct}%</td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-transparent font-bold">
                                <td colSpan={2} className="border border-black p-1.5 text-left uppercase tracking-widest text-[10pt]">Total</td>
                                <td className="border border-black p-1.5 text-left font-bold font-english">{formatMark(blueprint.totalMarks)}</td>
                                <td className="border border-black p-1.5 text-left font-english">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* IV. Item Format */}
                <div className="mb-6 avoid-break">
                    <h3 className="text-[10pt] font-bold mb-1 text-black uppercase">IV. Weightage to Item Format</h3>
                    <table className="w-full border-collapse border border-black text-[10pt] table-fixed">
                        <thead>
                            <tr className="bg-transparent">
                                <th className="border border-black p-1 w-[8%] font-bold text-center text-[10pt]" rowSpan={2}>Sl. No.</th>
                                <th className="border border-black p-1 w-[12%] font-bold text-center text-[10pt]" rowSpan={2}>Item Group</th>
                                <th className="border border-black p-1 w-[8%] font-bold text-center text-[10pt]" rowSpan={2}>Code</th>
                                <th className="border border-black p-1 w-[22%] font-bold text-center text-[10pt]" rowSpan={2}>Item Type</th>
                                <th className="border border-black p-1 w-[12%] font-bold text-center text-[10pt]" rowSpan={2}>No. of Items</th>
                                <th className="border border-black p-1 w-[12%] font-bold text-center text-[10pt]" rowSpan={2}>Estimated Time</th>
                                <th className="border border-black p-1 w-[13%] font-bold text-center text-[10pt]" rowSpan={2}>Score allotted</th>
                                <th className="border border-black p-1 w-[13%] font-bold text-center text-[10pt]" rowSpan={2}>Percentage</th>
                            </tr>
                            <tr className="bg-transparent" />
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
                                        {/* Row 1: SR1 - Multiple Choice Items */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]" rowSpan={2}>1</td>
                                            <td className="border border-black p-1 text-center font-bold text-[10pt] whitespace-normal break-words" rowSpan={2}>SR Item</td>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">SR₁</td>
                                            <td className="border border-black p-1 text-left font-english text-[10pt]">Multiple Choice Items</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{formatVal(sr1.count)}</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{formatVal(sr1.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">{sr1.score ? formatMark(sr1.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{sr1.score > 0 ? `${getPct(sr1.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 2: SR2 - Matching Items */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">SR₂</td>
                                            <td className="border border-black p-1 text-left font-english text-[10pt]">Matching Items</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{formatVal(sr2.count)}</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{formatVal(sr2.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">{sr2.score ? formatMark(sr2.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{sr2.score > 0 ? `${getPct(sr2.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 3: CRS1 - Very Short Answer */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]" rowSpan={2}>2</td>
                                            <td className="border border-black p-1 text-center font-bold text-[10pt] whitespace-normal break-words" rowSpan={2}>CRS Item</td>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">CRS₁</td>
                                            <td className="border border-black p-1 text-left font-english text-[10pt]">Very Short Answer</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{formatVal(crs1.count)}</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{formatVal(crs1.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">{crs1.score ? formatMark(crs1.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{crs1.score > 0 ? `${getPct(crs1.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 4: CRS2 - Short Answer */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">CRS₂</td>
                                            <td className="border border-black p-1 text-left font-english text-[10pt]">Short Answer</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{formatVal(crs2.count)}</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{formatVal(crs2.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">{crs2.score ? formatMark(crs2.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{crs2.score > 0 ? `${getPct(crs2.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Row 5: CRL - Essay */}
                                        <tr>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">3</td>
                                            <td className="border border-black p-1 text-center font-bold text-[10pt] whitespace-normal break-words">CRL Item</td>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">CRL</td>
                                            <td className="border border-black p-1 text-left font-english text-[10pt]">Essay</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{formatVal(crl.count)}</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{formatVal(crl.time)}</td>
                                            <td className="border border-black p-1 text-center font-bold font-english text-[10pt]">{crl.score ? formatMark(crl.score) : '-'}</td>
                                            <td className="border border-black p-1 text-center font-english text-[10pt]">{crl.score > 0 ? `${getPct(crl.score)}%` : '-'}</td>
                                        </tr>
                                        {/* Total Row */}
                                        <tr className="bg-transparent font-bold">
                                            <td colSpan={4} className="border border-black p-1.5 text-center uppercase tracking-widest text-[10pt]">Total</td>
                                            <td className="border border-black p-1.5 text-center font-english text-[10pt]">{totalCount || '-'}</td>
                                            <td className="border border-black p-1.5 text-center font-english text-[10pt]">{totalTime || '-'}</td>
                                            <td className="border border-black p-1.5 text-center font-english text-[10pt]">{formatMark(totalScore)}</td>
                                            <td className="border border-black p-1.5 text-center font-english text-[10pt]">100%</td>
                                        </tr>
                                    </>
                                );
                            })()}
                        </tbody>
                    </table>
                    <div className="text-[10pt] mt-2 text-black leading-relaxed font-english">
                        <div className="font-bold mb-1 uppercase tracking-wider text-[10pt]">Index of Abbreviations:</div>
                        <div className="grid grid-cols-2 gap-x-15 max-w-xl text-[10pt]">
                            <div>
                                <span className="font-bold w-[40px] inline-block">SR</span> -  Selected Response<br />
                                <span className="font-bold w-[40px] inline-block">SR₁</span> -  Multiple Choice Items<br />
                                <span className="font-bold w-[40px] inline-block">SR₂</span> -  Matching Items<br />
                                <span className="font-bold w-[40px] inline-block">CRS</span> -  Constructed Response Short Answer
                            </div>
                            <div>
                                <span className="font-bold w-[40px] inline-block">CRS₁</span> -  Very Short Answer<br />
                                <span className="font-bold w-[40px] inline-block">CRS₂</span> -  Short Answer<br />
                                <span className="font-bold w-[40px] inline-block">CRL</span> -  Constructed Response Long Answer (Essay)
                            </div>
                        </div>
                    </div>
                </div>

                {/* V & VI */}
                <div className="avoid-break border-t border-black pt-4 mt-4 text-[10pt]">
                    {/* V. Scheme of Sections */}
                    <div className="mb-4">
                        <h3 className="font-bold text-black uppercase text-[10pt]">V. Scheme of Sections :</h3>
                    </div>

                    {/* VI. Pattern of Options */}
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ fontWeight: 'bold', color: '#000', width: '180px', textTransform: 'uppercase', fontSize: '10pt' }}>VI. Pattern of Options :</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ width: '110px', display: 'inline-block' }}>Internal choice</span>
                                <div style={{
                                    border: '1px solid #000',
                                    width: '18px',
                                    height: '18px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '10pt'
                                }} className="font-english">
                                    {blueprint.items.some(i => i.hasInternalChoice) ? '✓' : ''}
                                </div>
                                <span style={{ fontWeight: '500' }} className="font-medium font-english text-[10pt]">33 – 35%</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ width: '110px', display: 'inline-block' }}>Overall choice</span>
                                <div style={{
                                    border: '1px solid #000',
                                    width: '18px',
                                    height: '18px',
                                    display: 'inline-flex',
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
                    font-family: '${settings.fontFamilyEnglish || 'Times New Roman'}', serif !important;
                }
                .tamil-font {
                    font-family: '${settings.fontFamily || 'TAU-Paalai'}', serif !important;
                    font-size: ${settings.fontSizeTamil || 10.5}pt !important;
                }
                .font-english {
                    font-family: '${settings.fontFamilyEnglish || 'Times New Roman'}', serif !important;
                }
                /* Dynamic font size for English elements in Report 1 */
                .report1-container,
                .report1-container table,
                .report1-container th,
                .report1-container td,
                .report1-container div,
                .report1-container span,
                .report1-container p,
                .report1-container h3 {
                    font-size: ${settings.fontSizeEnglish || settings.fontSizeBody || 10}pt;
                }
                
                /* Override tailwind text-[10pt] and text-[10.5pt] classes */
                .report1-container .text-\\[10pt\\] {
                    font-size: ${settings.fontSizeEnglish || settings.fontSizeBody || 10}pt !important;
                }
                .report1-container .text-\\[10\\.5pt\\] {
                    font-size: ${settings.fontSizeTamil || 10.5}pt !important;
                }
                
                /* Ensure specific elements like headers scale too */
                .report1-container th, 
                .report1-container td {
                    font-size: ${settings.fontSizeEnglish || settings.fontSizeBody || 10}pt;
                }
                .report1-container td.tamil-font {
                    font-size: ${settings.fontSizeTamil || 10.5}pt !important;
                }

                @media print {
                    .report-page {
                        box-shadow: none !important;
                        margin: 0 !important;
                        width: 100% !important;
                        min-height: 0 !important;
                        height: auto !important;
                        page-break-after: auto !important;
                        page-break-inside: auto !important;
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
                    .tamil-font {
                        font-family: '${settings.fontFamily || 'TAU-Paalai'}', serif !important;
                        font-size: ${settings.fontSizeTamil || 7}pt !important;
                        line-height: 1.1 !important;
                    }
                    /* Intelligent compression for Report 1 to prevent 2-line spillover to page 3 */
                    table th, table td {
                        padding-top: 3px !important;
                        padding-bottom: 3px !important;
                    }
                }
            ` }} />
        </div>
    );
};
