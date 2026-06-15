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
 * Report3: Unit Wise Analysis
 * 
 * Features:
 * - Aggregated Internal Choice rows at unit end
 * - Internal choices highlighted in light gray
 * - Choice items excluded from totals/time counts
 */
export const Report3: React.FC<Report3Props> = ({ blueprint, data }) => {
    const { matrixRows } = data;

    // Column-by-column aggregates (Total Item row)
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

        matrixRows.forEach(unit => {
            unit.subUnits.forEach((sub: any) => {
                // Internal choice rows don't count towards grand totals as per request
                if (sub.isInternalChoiceRow) return;

                const stats = sub.statsA;
                
                // CPs
                ['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7'].forEach(cp => {
                    counts.cp[cp as keyof typeof counts.cp] += stats.cp[cp].count;
                    scores.cp[cp as keyof typeof scores.cp] += stats.cp[cp].score;
                });

                // Levels
                ['B', 'A', 'P'].forEach(kl => {
                    counts.levels[kl as keyof typeof counts.levels] += stats.levels[kl].count;
                    scores.levels[kl as keyof typeof scores.levels] += stats.levels[kl].score;
                });

                // Formats
                ['SR1', 'SR2', 'CRS1', 'CRS2', 'CRL'].forEach(fmt => {
                    counts.formats[fmt as keyof typeof counts.formats] += stats.formats[fmt].count;
                    scores.formats[fmt as keyof typeof scores.formats] += stats.formats[fmt].score;
                });

                grandTime += sub.timeA;
                grandItems += sub.itemsA;
                grandScore += sub.scoreA;
            });
        });

        return { counts, scores, grandTime, grandItems, grandScore };
    }, [matrixRows]);

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
                
                <ReportHeader blueprint={blueprint} sectionTitle="PART – II : UNIT WISE ANALYSIS" orientation="landscape" />

                <table className="w-full border-collapse border-2 border-black mt-4" 
                       style={{ tableLayout: 'fixed', width: '100%', fontSize: '9pt' }}>
                    <colgroup><col style={{ width: '75px' }} /><col style={{ width: '150px' }} /><col style={{ width: '100px' }} /><col style={{ width: '32px' }} /><col style={{ width: '32px' }} /><col style={{ width: '32px' }} /><col style={{ width: '32px' }} /><col style={{ width: '32px' }} /><col style={{ width: '32px' }} /><col style={{ width: '32px' }} /><col style={{ width: '32px' }} /><col style={{ width: '32px' }} /><col style={{ width: '32px' }} /><col style={{ width: '36px' }} /><col style={{ width: '36px' }} /><col style={{ width: '36px' }} /><col style={{ width: '36px' }} /><col style={{ width: '36px' }} /><col style={{ width: '36px' }} /><col style={{ width: '36px' }} /><col style={{ width: '36px' }} /></colgroup>
                    <thead>
                        <tr className="bg-transparent">
                            <th colSpan={3} className="border border-black p-1 text-[9px] font-bold">Content Area</th>
                            <th colSpan={7} className="border border-black p-1 text-[9px] font-bold">Cognitive Process</th>
                            <th colSpan={3} className="border border-black p-1 text-[9px] font-bold">Knowledge Level</th>
                            <th colSpan={5} className="border border-black p-1 text-[9px] font-bold">Item Format</th>
                            <th rowSpan={2} className="border border-black" style={narrowThStyle}>Answering<br />Time</th>
                            <th rowSpan={2} className="border border-black" style={narrowThStyle}>Total<br />Item</th>
                            <th rowSpan={2} className="border border-black" style={narrowThStyle}>Total<br />Score</th>
                        </tr>
                        <tr className="bg-transparent">
                            <th className="border border-black p-1 text-[8pt] font-bold">Topic / Unit / Chapter</th>
                            <th className="border border-black p-1 text-[8pt] font-normal" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>Learning Objective</th>
                            <th className="border border-black p-1 text-[8pt] font-normal">Sub Topic / Sub Unit / Discourse</th>
                            
                            {[
                                { key: 'CP1', label: 'CP₁' },
                                { key: 'CP2', label: 'CP₂' },
                                { key: 'CP3', label: 'CP₃' },
                                { key: 'CP4', label: 'CP₄' },
                                { key: 'CP5', label: 'CP₅' },
                                { key: 'CP6', label: 'CP₆' },
                                { key: 'CP7', label: 'CP₇' }
                            ].map(cp => (
                                <th key={cp.key} className="border border-black" style={narrowThStyle}>{cp.label}</th>
                            ))}
                            {['B', 'A', 'P'].map(kl => (
                                <th key={kl} className="border border-black" style={narrowThStyle}>{kl}</th>
                            ))}
                            {[
                                { key: 'SR1', label: 'SR₁' },
                                { key: 'SR2', label: 'SR₂' },
                                { key: 'CRS1', label: 'CRS₁' },
                                { key: 'CRS2', label: 'CRS₂' },
                                { key: 'CRL', label: 'CRL' }
                            ].map(fmt => (
                                <th key={fmt.key} className="border border-black" style={narrowThStyle}>{fmt.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matrixRows.map((unit, unitIdx) => {
                            const rowCount = unit.subUnits.length;
                            return unit.subUnits.map((sub: any, subIdx: number) => {
                                const isInternal = sub.isInternalChoiceRow;
                                return (
                                    <tr key={`unit-${unitIdx}-sub-${subIdx}`} 
                                        style={isInternal ? { backgroundColor: '#e5e7eb' } : { backgroundColor: 'transparent' }}>
                                        
                                        {subIdx === 0 && (
                                            <>
                                                <td rowSpan={rowCount} className="border border-black p-1 text-left font-bold tamil-font" style={{ fontSize: '8pt', wordBreak: 'break-word' }}>
                                                    {unit.unitNumber}. {unit.unitName}
                                                </td>
                                                <td rowSpan={rowCount} className="border border-black" style={contentCellStyle}>
                                                    {unit.learningObjective}
                                                </td>
                                            </>
                                        )}

                                        <td className="border border-black p-1 text-left italic tamil-font" style={{ fontSize: '8pt', wordBreak: 'break-word' }}>
                                            {sub.subTopicName}
                                        </td>

                                        {/* CP Stats */}
                                        {['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7'].map(cp => (
                                            <td key={cp} className="border border-black" style={narrowTdStyle}>
                                                {sub.statsA.cp[cp].score > 0 ? (
                                                    <>{sub.statsA.cp[cp].count},{formatMark(sub.statsA.cp[cp].score)}</>
                                                ) : ''}
                                            </td>
                                        ))}

                                        {/* KL Stats */}
                                        {['B', 'A', 'P'].map(kl => (
                                            <td key={kl} className="border border-black font-bold" style={narrowTdStyle}>
                                                {sub.statsA.levels[kl].score > 0 ? (
                                                    <>{sub.statsA.levels[kl].count},{formatMark(sub.statsA.levels[kl].score)}</>
                                                ) : ''}
                                            </td>
                                        ))}

                                        {/* Format Stats */}
                                        {['SR1', 'SR2', 'CRS1', 'CRS2', 'CRL'].map(fmt => (
                                            <td key={fmt} className="border border-black" style={narrowTdStyle}>
                                                {sub.statsA.formats[fmt].score > 0 ? (
                                                    <>{sub.statsA.formats[fmt].count},{formatMark(sub.statsA.formats[fmt].score)}</>
                                                ) : ''}
                                            </td>
                                        ))}

                                        {/* Answering Time */}
                                        <td className="border border-black font-bold" style={narrowTdStyle}>
                                            {isInternal ? (
                                                sub.hasInternalChoice ? (sub.timeA ? sub.timeA : '') : '-'
                                            ) : (
                                                sub.timeA ? sub.timeA : ''
                                            )}
                                        </td>

                                        {subIdx % 2 === 0 && (
                                            <>
                                                <td rowSpan={2} className="border border-black font-bold bg-transparent" style={narrowTdStyle}>
                                                    {sub.itemsA || ''}
                                                </td>
                                                <td rowSpan={2} className="border border-black font-black bg-transparent" style={narrowTdStyle}>
                                                    {sub.scoreA ? formatMark(sub.scoreA) : ''}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            });
                        })}

                        {/* Total Item Row */}
                        <tr className="bg-transparent font-bold">
                            <td colSpan={3} className="border border-black p-1 text-center font-bold" style={{ fontSize: '9pt' }}>Total Item</td>
                            
                            {/* CP Item Totals */}
                            {['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7'].map(cp => (
                                <td key={cp} className="border border-black text-center" style={narrowTdStyle}>
                                    {columnTotals.counts.cp[cp as keyof typeof columnTotals.counts.cp] || ''}
                                </td>
                            ))}

                            {/* Level Item Totals */}
                            {['B', 'A', 'P'].map(kl => (
                                <td key={kl} className="border border-black text-center" style={narrowTdStyle}>
                                    {columnTotals.counts.levels[kl as keyof typeof columnTotals.counts.levels] || ''}
                                </td>
                            ))}

                            {/* Format Item Totals */}
                            {['SR1', 'SR2', 'CRS1', 'CRS2', 'CRL'].map(fmt => (
                                <td key={fmt} className="border border-black text-center" style={narrowTdStyle}>
                                    {columnTotals.counts.formats[fmt as keyof typeof columnTotals.counts.formats] || ''}
                                </td>
                            ))}

                            {/* Answering Time Grand Total (spanned) */}
                            <td rowSpan={2} className="border border-black text-center font-bold" style={narrowTdStyle}>
                                {columnTotals.grandTime || ''}
                            </td>

                            {/* Total Item Grand Total */}
                            <td className="border border-black text-center font-bold" style={narrowTdStyle}>
                                {columnTotals.grandItems || ''}
                            </td>

                            {/* Total Score cell is empty in Total Item row */}
                            <td className="border border-black bg-transparent"></td>
                        </tr>

                        {/* Total Score Row */}
                        <tr className="bg-transparent font-bold">
                            <td colSpan={3} className="border border-black p-1 text-center font-bold" style={{ fontSize: '9pt' }}>Total Score</td>
                            
                            {/* CP Score Totals */}
                            {['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7'].map(cp => (
                                <td key={cp} className="border border-black text-center" style={narrowTdStyle}>
                                    {columnTotals.scores.cp[cp as keyof typeof columnTotals.scores.cp] || ''}
                                </td>
                            ))}

                            {/* Level Score Totals */}
                            {['B', 'A', 'P'].map(kl => (
                                <td key={kl} className="border border-black text-center" style={narrowTdStyle}>
                                    {columnTotals.scores.levels[kl as keyof typeof columnTotals.scores.levels] || ''}
                                </td>
                            ))}

                            {/* Format Score Totals */}
                            {['SR1', 'SR2', 'CRS1', 'CRS2', 'CRL'].map(fmt => (
                                <td key={fmt} className="border border-black text-center" style={narrowTdStyle}>
                                    {columnTotals.scores.formats[fmt as keyof typeof columnTotals.scores.formats] || ''}
                                </td>
                            ))}

                            {/* Total Item cell is blacked out / empty in Total Score row */}
                            <td className="border border-black" style={{ backgroundColor: '#000000' }}></td>

                            {/* Total Score Grand Total */}
                            <td className="border border-black text-center font-bold" style={narrowTdStyle}>
                                {formatMark(columnTotals.grandScore)}
                            </td>
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
