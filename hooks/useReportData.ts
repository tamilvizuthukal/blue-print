import { useMemo } from 'react';
import { Blueprint, Curriculum, BlueprintItem, Discourse, CognitiveProcess, KnowledgeLevel, ItemFormat } from '../types';
import { cpDefinitions, levelDefinitions, formatDefinitions, createStats, addToStats } from '../services/reportUtils';

export interface ReportData {
    contentAreaRows: any[];
    cpWeightage: any[];
    klWeightage: any;
    formatWeightage: any;
    itemRows: any[];
    matrixRows: any[];
}

export function useReportData(blueprint: Blueprint | null, curriculum: Curriculum | null, discourses: Discourse[]): ReportData {
    
    const emptyStats = createStats();

    const orderedItems = useMemo(() => {
        if (!blueprint) return [];
        return [...blueprint.items].sort((a, b) => {
            const aNum = parseInt(a.id.split('-').pop() || '0');
            const bNum = parseInt(b.id.split('-').pop() || '0');
            return aNum - bNum;
        });
    }, [blueprint]);

    // Section I: Content Area weightage
    const contentAreaRows = useMemo(() => {
        if (!blueprint || !curriculum) return [];
        const units = curriculum.units;
        return units.map(unit => {
            const unitItems = blueprint.items.filter(item => item.unitId === unit.id);
            const totalScore = unitItems.reduce((sum, item) => sum + (item.marksPerQuestion * item.questionCount), 0);
            return {
                unit: unit.name,
                unitNumber: unit.unitNumber,
                learningObjective: unit.learningOutcomes || '-',
                discourses: unit.subUnits.map(s => s.name).join(', '),
                score: totalScore,
                pct: ((totalScore / blueprint.totalMarks) * 100).toFixed(1) + '%',
            };
        }).filter(r => r.score > 0);
    }, [blueprint, curriculum]);

    // Section II: Cognitive Process weightage
    const cpWeightage = useMemo(() => {
        if (!blueprint) return [];
        const stats = createStats();
        blueprint.items.forEach(item => {
            const score = item.marksPerQuestion * item.questionCount;
            addToStats(stats, item.cognitiveProcess as CognitiveProcess, item.knowledgeLevel as KnowledgeLevel, item.itemFormat as ItemFormat, score, item.questionCount);
            if (item.hasInternalChoice) {
                addToStats(stats, (item.cognitiveProcessB || item.cognitiveProcess) as CognitiveProcess, (item.knowledgeLevelB || item.knowledgeLevel) as KnowledgeLevel, (item.itemFormatB || item.itemFormat) as ItemFormat, score, item.questionCount);
            }
        });

        return cpDefinitions.map(def => {
            const score = stats.cp[def.key].score;
            return {
                key: def.key,
                label: def.label,
                score: score || 0,
                pct: score ? ((score / (blueprint.totalMarks * (blueprint.items.some(i => i.hasInternalChoice) ? 2 : 1))) * 100).toFixed(1) : '0'
            };
        });
    }, [blueprint]);

    // Section III: Knowledge Level
    const klWeightage = useMemo(() => {
        const kl = { Basic: 0, Average: 0, Profound: 0 };
        if (!blueprint) return kl;
        blueprint.items.forEach(item => {
            const score = item.marksPerQuestion * item.questionCount;
            if (item.knowledgeLevel === KnowledgeLevel.BASIC) kl.Basic += score;
            if (item.knowledgeLevel === KnowledgeLevel.AVERAGE) kl.Average += score;
            if (item.knowledgeLevel === KnowledgeLevel.PROFOUND) kl.Profound += score;
            
            if (item.hasInternalChoice) {
                const klB = item.knowledgeLevelB || item.knowledgeLevel;
                if (klB === KnowledgeLevel.BASIC) kl.Basic += score;
                if (klB === KnowledgeLevel.AVERAGE) kl.Average += score;
                if (klB === KnowledgeLevel.PROFOUND) kl.Profound += score;
            }
        });
        return kl;
    }, [blueprint]);

    // Section IV: Item Format
    const formatWeightage = useMemo(() => {
        const fmt = {
            SR1: { count: 0, time: 0, score: 0 },
            SR2: { count: 0, time: 0, score: 0 },
            CRS1: { count: 0, time: 0, score: 0 },
            CRS2: { count: 0, time: 0, score: 0 },
            CRL: { count: 0, time: 0, score: 0 },
        };
        if (!blueprint) return fmt;
        blueprint.items.forEach(item => {
            const f = item.itemFormat as keyof typeof fmt;
            if (fmt[f]) {
                fmt[f].count += item.questionCount;
                fmt[f].time += (item.time || 0);
                fmt[f].score += (item.marksPerQuestion * item.questionCount);
            }
            if (item.hasInternalChoice) {
                const fB = (item.itemFormatB || item.itemFormat) as keyof typeof fmt;
                if (fmt[fB]) {
                    fmt[fB].count += item.questionCount;
                    fmt[fB].time += (item.time || 0);
                    fmt[fB].score += (item.marksPerQuestion * item.questionCount);
                }
            }
        });
        return fmt;
    }, [blueprint]);

    // Report 2: Item-wise rows
    const itemRows = useMemo(() => {
        if (!blueprint || !curriculum) return [];
        return blueprint.items.map((item, idx) => {
            const unit = curriculum.units.find(u => u.id === item.unitId);
            const subUnit = unit?.subUnits.find(s => s.id === item.subUnitId);
            const score = item.marksPerQuestion * item.questionCount;
            
            const getCPCell = (cp: string, currentCP: string, count: number, score: number) => {
                return cp === currentCP ? `1(${score})` : '';
            };

            const baseRow = {
                qNo: (idx + 1).toString(),
                learningObjective: unit?.learningOutcomes || '-',
                unit: unit?.name || '-',
                subTopic: subUnit?.name || '-',
                score: score,
                items: item.questionCount,
                time: item.time || 0,
                cp: {
                    CP1: getCPCell('CP1', item.cognitiveProcess as string, 1, score),
                    CP2: getCPCell('CP2', item.cognitiveProcess as string, 1, score),
                    CP3: getCPCell('CP3', item.cognitiveProcess as string, 1, score),
                    CP4: getCPCell('CP4', item.cognitiveProcess as string, 1, score),
                    CP5: getCPCell('CP5', item.cognitiveProcess as string, 1, score),
                    CP6: getCPCell('CP6', item.cognitiveProcess as string, 1, score),
                    CP7: getCPCell('CP7', item.cognitiveProcess as string, 1, score),
                },
                kl: {
                    basic: item.knowledgeLevel === KnowledgeLevel.BASIC ? `1(${score})` : '',
                    average: item.knowledgeLevel === KnowledgeLevel.AVERAGE ? `1(${score})` : '',
                    profound: item.knowledgeLevel === KnowledgeLevel.PROFOUND ? `1(${score})` : '',
                },
                fmt: {
                    SR1: item.itemFormat === ItemFormat.SR1 ? `1(${score})` : '',
                    SR2: item.itemFormat === ItemFormat.SR2 ? `1(${score})` : '',
                    CRS1: item.itemFormat === ItemFormat.CRS1 ? `1(${score})` : '',
                    CRS2: item.itemFormat === ItemFormat.CRS2 ? `1(${score})` : '',
                    CRL: item.itemFormat === ItemFormat.CRL ? `1(${score})` : '',
                }
            };

            if (!item.hasInternalChoice) return [baseRow];

            const unitB = curriculum.units.find(u => u.id === (item.unitIdB || item.unitId));
            const subUnitB = unitB?.subUnits.find(s => s.id === (item.subUnitIdB || item.subUnitId));
            const klB = item.knowledgeLevelB || item.knowledgeLevel;
            const fmtB = item.itemFormatB || item.itemFormat;
            const cpB = item.cognitiveProcessB || item.cognitiveProcess;

            return [
                { ...baseRow, qNo: `${idx + 1}(அ)` },
                {
                    qNo: `${idx + 1}(ஆ)`,
                    learningObjective: unitB?.learningOutcomes || '-',
                    unit: unitB?.name || '-',
                    subTopic: subUnitB?.name || '-',
                    score: score,
                    items: item.questionCount,
                    time: item.time || 0,
                    cp: {
                        CP1: getCPCell('CP1', cpB as string, 1, score),
                        CP2: getCPCell('CP2', cpB as string, 1, score),
                        CP3: getCPCell('CP3', cpB as string, 1, score),
                        CP4: getCPCell('CP4', cpB as string, 1, score),
                        CP5: getCPCell('CP5', cpB as string, 1, score),
                        CP6: getCPCell('CP6', cpB as string, 1, score),
                        CP7: getCPCell('CP7', cpB as string, 1, score),
                    },
                    kl: {
                        basic: klB === KnowledgeLevel.BASIC ? `1(${score})` : '',
                        average: klB === KnowledgeLevel.AVERAGE ? `1(${score})` : '',
                        profound: klB === KnowledgeLevel.PROFOUND ? `1(${score})` : '',
                    },
                    fmt: {
                        SR1: fmtB === ItemFormat.SR1 ? `1(${score})` : '',
                        SR2: fmtB === ItemFormat.SR2 ? `1(${score})` : '',
                        CRS1: fmtB === ItemFormat.CRS1 ? `1(${score})` : '',
                        CRS2: fmtB === ItemFormat.CRS2 ? `1(${score})` : '',
                        CRL: fmtB === ItemFormat.CRL ? `1(${score})` : '',
                    }
                }
            ];
        }).flat();
    }, [blueprint, curriculum]);

    // Report 3: Matrix rows
    const matrixRows = useMemo(() => {
        if (!blueprint || !curriculum) return [];
        const rows: any[] = [];
        curriculum.units.forEach(unit => {
            const unitItems = blueprint.items.filter(item => item.unitId === unit.id || (item.hasInternalChoice && item.unitIdB === unit.id));
            if (unitItems.length === 0) return;

            unit.subUnits.forEach(subUnit => {
                const subUnitItemsA = blueprint.items.filter(item => item.unitId === unit.id && item.subUnitId === subUnit.id);
                const subUnitItemsB = blueprint.items.filter(item => item.hasInternalChoice && item.unitIdB === unit.id && item.subUnitIdB === subUnit.id);
                
                if (subUnitItemsA.length === 0 && subUnitItemsB.length === 0) return;

                const rowStats = createStats();
                let totalTime = 0;
                let totalItems = 0;
                let totalScore = 0;

                subUnitItemsA.forEach(item => {
                    const score = item.marksPerQuestion * item.questionCount;
                    addToStats(rowStats, item.cognitiveProcess as CognitiveProcess, item.knowledgeLevel as KnowledgeLevel, item.itemFormat as ItemFormat, score, item.questionCount);
                    totalTime += (item.time || 0);
                    totalItems += item.questionCount;
                    totalScore += score;
                });

                subUnitItemsB.forEach(item => {
                    const score = item.marksPerQuestion * item.questionCount;
                    addToStats(rowStats, (item.cognitiveProcessB || item.cognitiveProcess) as CognitiveProcess, (item.knowledgeLevelB || item.knowledgeLevel) as KnowledgeLevel, (item.itemFormatB || item.itemFormat) as ItemFormat, score, item.questionCount);
                    totalTime += (item.time || 0);
                    totalItems += item.questionCount;
                    totalScore += score;
                });

                rows.push({
                    unit: unit.name,
                    unitNumber: unit.unitNumber,
                    learningObjective: unit.learningOutcomes || '-',
                    subTopic: subUnit.name,
                    stats: rowStats,
                    time: totalTime,
                    items: totalItems,
                    score: totalScore
                });
            });
        });
        return rows;
    }, [blueprint, curriculum]);

    return { contentAreaRows, cpWeightage, klWeightage, formatWeightage, itemRows, matrixRows };
}
