import { useMemo } from 'react';
import { Blueprint, Curriculum, BlueprintItem, Discourse, CognitiveProcess, KnowledgeLevel, ItemFormat } from '../types';
import { 
    cpDefinitions, 
    levelDefinitions, 
    formatDefinitions, 
    createStats, 
    addToStats,
    normalizeCPValue,
    normalizeLevelValue,
    normalizeFormatValue 
} from '../services/reportUtils';
import { getDB } from '../services/db';
import { sortBlueprintItems } from '../utils/reportCalculations';

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
        const db = getDB();
        const paperType = db?.questionPaperTypes.find(pt => pt.id === blueprint.questionPaperTypeId);
        return sortBlueprintItems(blueprint.items, curriculum, paperType);
    }, [blueprint, curriculum]);

    // Section I: Content Area weightage
    const contentAreaRows = useMemo(() => {
        if (!blueprint || !curriculum) return [];
        const units = curriculum.units;
        return units.map(unit => {
            const unitItems = blueprint.items.filter(item => item.unitId === unit.id);
            if (unitItems.length === 0) return null;

            const totalScore = unitItems.reduce((sum, item) => sum + (item.marksPerQuestion * item.questionCount), 0);
            
            // Subunit breakdown
            const subunits = unit.subUnits.map(su => {
                const suItems = unitItems.filter(item => item.subUnitId === su.id);
                const suScore = suItems.reduce((sum, item) => sum + (item.marksPerQuestion * item.questionCount), 0);
                return {
                    name: su.name,
                    score: suScore
                };
            }).filter(s => s.score > 0);

            return {
                unit: unit.name,
                unitNumber: unit.unitNumber,
                learningObjective: unit.learningOutcomes || '-',
                score: totalScore,
                pct: ((totalScore / blueprint.totalMarks) * 100).toFixed(1) + '%',
                subunits: subunits
            };
        }).filter(Boolean);
    }, [blueprint, curriculum, blueprint?.totalMarks]);

    // Section II: Cognitive Process weightage
    const cpWeightage = useMemo(() => {
        if (!blueprint) return [];
        const stats = createStats();
        blueprint.items.forEach(item => {
            const score = item.marksPerQuestion * item.questionCount;
            addToStats(stats, item.cognitiveProcess as CognitiveProcess, item.knowledgeLevel as KnowledgeLevel, item.itemFormat as ItemFormat, score, item.questionCount);
        });

        return cpDefinitions.map(def => {
            const score = stats.cp[def.key].score;
            const count = stats.cp[def.key].count;
            return {
                key: def.key,
                label: def.label,
                count: count || 0,
                score: score || 0,
                pct: score ? ((score / blueprint.totalMarks) * 100).toFixed(1) : '0'
            };
        });
    }, [blueprint]);

    // Section III: Knowledge Level
    const klWeightage = useMemo(() => {
        const kl = {
            Basic: { count: 0, score: 0 },
            Average: { count: 0, score: 0 },
            Profound: { count: 0, score: 0 }
        };
        if (!blueprint) return kl;
        blueprint.items.forEach(item => {
            const score = item.marksPerQuestion * item.questionCount;
            const normKL = normalizeLevelValue(item.knowledgeLevel as string) as KnowledgeLevel;
            if (normKL === KnowledgeLevel.BASIC) {
                kl.Basic.count += item.questionCount;
                kl.Basic.score += score;
            }
            else if (normKL === KnowledgeLevel.AVERAGE) {
                kl.Average.count += item.questionCount;
                kl.Average.score += score;
            }
            else if (normKL === KnowledgeLevel.PROFOUND) {
                kl.Profound.count += item.questionCount;
                kl.Profound.score += score;
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

        // Robust format classifier: handles ALL possible stored values
        // (enum values, abbreviations, full names, partial matches)
        const classifyFormat = (raw: string | undefined): keyof typeof fmt | null => {
            if (!raw) return null;
            const s = raw.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            // Check from most specific to least specific to avoid false matches

            // CRS1 / Very Short Answer (check before SR1 to avoid 'sr1' matching 'crs1')
            if (s === 'crs1' || s.startsWith('crs1') || s.includes('veryshor') ||
                s.includes('vsa') || s === 'crs1vsa') return 'CRS1';

            // CRS2 / Short Answer
            if (s === 'crs2' || s.startsWith('crs2') || s === 'crs2sa' ||
                (s.includes('shortanswer') && !s.includes('very'))) return 'CRS2';


            // CRL / Essay
            if (s === 'crl' || s.startsWith('crle') || s.includes('crle') ||
                s.includes('essay') || s.includes('longanswer')) return 'CRL';

            // SR2 / Matching Items (check before SR1 to avoid 'sr2' being caught by 'sr1')
            if (s === 'sr2' || s.startsWith('sr2') || s === 'sr2mi' ||
                s.includes('matchingitem') || s.includes('matchingit') ||
                s === 'mi' || (s.includes('matching') && !s.includes('multiple'))) return 'SR2';

            // SR1 / Multiple Choice Items
            if (s === 'sr1' || s.startsWith('sr1') || s === 'sr1mci' ||
                s.includes('multiplechoice') || s === 'mci' ||
                s.includes('selectedresponse1')) return 'SR1';

            // Fallback: try the original normalizeFormatValue
            const normFmt = normalizeFormatValue(raw) as ItemFormat;
            const key = formatDefinitions.find(d => d.value === normFmt)?.key as keyof typeof fmt;
            return key || null;
        };

        blueprint.items.forEach(item => {
            const key = classifyFormat(item.itemFormat as string);
            // Debug: log format classification (remove after verification)
            console.log(`[formatWeightage] itemFormat="${item.itemFormat}" → s="${(item.itemFormat||'').toString().trim().toLowerCase().replace(/[^a-z0-9]/g,'')}" → key="${key}"`);
            if (key && fmt[key]) {
                fmt[key].count += item.questionCount;
                fmt[key].time += (item.time || 0);
                fmt[key].score += (item.marksPerQuestion * item.questionCount);
            }
        });
        return fmt;
    }, [blueprint]);



    // Report 2: Item-wise rows
    const itemRows = useMemo(() => {
        if (!blueprint || !curriculum) return [];
        return orderedItems.map((item, idx) => {
            const unit = curriculum.units.find(u => u.id === item.unitId);
            const subUnit = unit?.subUnits.find(s => s.id === item.subUnitId);
            const score = item.marksPerQuestion * item.questionCount;
            
            const normCP = normalizeCPValue(item.cognitiveProcess as string) as CognitiveProcess;
            const cpKey = cpDefinitions.find(d => d.value === normCP)?.key;
            const normKL = normalizeLevelValue(item.knowledgeLevel as string) as KnowledgeLevel;
            const normFmt = normalizeFormatValue(item.itemFormat as string) as ItemFormat;

            const baseRow = {
                qNo: (idx + 1).toString(),
                learningObjective: subUnit?.learningOutcomes?.trim() ? subUnit.learningOutcomes.trim() : 'Add Learning Objective',
                unit: unit?.name || '-',
                subTopic: subUnit?.name || '-',
                score: score,
                items: item.questionCount,
                time: item.time || 0,
                cp: {
                    CP1: cpKey === 'CP1' ? `1(${score})` : '',
                    CP2: cpKey === 'CP2' ? `1(${score})` : '',
                    CP3: cpKey === 'CP3' ? `1(${score})` : '',
                    CP4: cpKey === 'CP4' ? `1(${score})` : '',
                    CP5: cpKey === 'CP5' ? `1(${score})` : '',
                    CP6: cpKey === 'CP6' ? `1(${score})` : '',
                    CP7: cpKey === 'CP7' ? `1(${score})` : '',
                },
                kl: {
                    basic: normKL === KnowledgeLevel.BASIC ? `1(${score})` : '',
                    average: normKL === KnowledgeLevel.AVERAGE ? `1(${score})` : '',
                    profound: normKL === KnowledgeLevel.PROFOUND ? `1(${score})` : '',
                },
                fmt: {
                    SR1: normFmt === ItemFormat.SR1 ? `1(${score})` : '',
                    SR2: normFmt === ItemFormat.SR2 ? `1(${score})` : '',
                    CRS1: normFmt === ItemFormat.CRS1 ? `1(${score})` : '',
                    CRS2: normFmt === ItemFormat.CRS2 ? `1(${score})` : '',
                    CRL: normFmt === ItemFormat.CRL ? `1(${score})` : '',
                }
            };

            if (!item.hasInternalChoice) return [baseRow];

            const unitB = curriculum.units.find(u => u.id === (item.unitIdB || item.unitId));
            const subUnitB = unitB?.subUnits.find(s => s.id === (item.subUnitIdB || item.subUnitId));
            
            const normCPB = normalizeCPValue((item.cognitiveProcessB || item.cognitiveProcess) as string) as CognitiveProcess;
            const cpKeyB = cpDefinitions.find(d => d.value === normCPB)?.key;
            const normKLB = normalizeLevelValue((item.knowledgeLevelB || item.knowledgeLevel) as string) as KnowledgeLevel;
            const normFmtB = normalizeFormatValue((item.itemFormatB || item.itemFormat) as string) as ItemFormat;

            return [
                { ...baseRow, qNo: `${idx + 1}(அ)`, isChoiceA: true },
                {
                    qNo: `${idx + 1}(ஆ)`,
                    isChoiceB: true,
                    learningObjective: subUnitB?.learningOutcomes?.trim() ? subUnitB.learningOutcomes.trim() : 'Add Learning Objective',
                    unit: unitB?.name || '-',
                    subTopic: subUnitB?.name || '-',
                    score: score,
                    items: item.questionCount,
                    time: item.time || 0,
                    cp: {
                        CP1: cpKeyB === 'CP1' ? `1(${score})` : '',
                        CP2: cpKeyB === 'CP2' ? `1(${score})` : '',
                        CP3: cpKeyB === 'CP3' ? `1(${score})` : '',
                        CP4: cpKeyB === 'CP4' ? `1(${score})` : '',
                        CP5: cpKeyB === 'CP5' ? `1(${score})` : '',
                        CP6: cpKeyB === 'CP6' ? `1(${score})` : '',
                        CP7: cpKeyB === 'CP7' ? `1(${score})` : '',
                    },
                    kl: {
                        basic: normKLB === KnowledgeLevel.BASIC ? `1(${score})` : '',
                        average: normKLB === KnowledgeLevel.AVERAGE ? `1(${score})` : '',
                        profound: normKLB === KnowledgeLevel.PROFOUND ? `1(${score})` : '',
                    },
                    fmt: {
                        SR1: normFmtB === ItemFormat.SR1 ? `1(${score})` : '',
                        SR2: normFmtB === ItemFormat.SR2 ? `1(${score})` : '',
                        CRS1: normFmtB === ItemFormat.CRS1 ? `1(${score})` : '',
                        CRS2: normFmtB === ItemFormat.CRS2 ? `1(${score})` : '',
                        CRL: normFmtB === ItemFormat.CRL ? `1(${score})` : '',
                    }
                }
            ];
        }).flat();
    }, [orderedItems, curriculum]);

    // Report 3: Matrix rows
    const matrixRows = useMemo(() => {
        if (!blueprint || !curriculum) return [];
        const unitsList: any[] = [];

        curriculum.units.forEach(unit => {
            // Find all Option A items for this unit
            const unitItemsA = blueprint.items.filter(item => item.unitId === unit.id);
            // Find all Option B items for this unit (hasInternalChoice = true and unitIdB / unitId matches unit.id)
            const unitItemsB = blueprint.items.filter(item => item.hasInternalChoice && (item.unitIdB || item.unitId) === unit.id);

            if (unitItemsA.length === 0 && unitItemsB.length === 0) return;

            // 1. Generate subtopic rows (for subUnits that have Option A or Option B questions)
            const subUnitsData: any[] = [];
            let unitTotalItems = 0;
            let unitTotalScore = 0;

            unit.subUnits.forEach(subUnit => {
                const subUnitItemsA = unitItemsA.filter(item => item.subUnitId === subUnit.id);
                const subUnitItemsB = unitItemsB.filter(item => (item.subUnitIdB || item.subUnitId) === subUnit.id);

                if (subUnitItemsA.length === 0 && subUnitItemsB.length === 0) return;

                const rowStatsA = createStats();
                let totalTimeA = 0;
                let totalItemsA = 0;
                let totalScoreA = 0;

                subUnitItemsA.forEach(item => {
                    const score = item.marksPerQuestion * item.questionCount;
                    addToStats(rowStatsA, item.cognitiveProcess as CognitiveProcess, item.knowledgeLevel as KnowledgeLevel, item.itemFormat as ItemFormat, score, item.questionCount);
                    totalTimeA += (item.time || 0);
                    totalItemsA += item.questionCount;
                    totalScoreA += score;
                });

                unitTotalItems += totalItemsA;
                unitTotalScore += totalScoreA;

                subUnitsData.push({
                    subUnitId: subUnit.id,
                    subTopicName: subUnit.name,
                    statsA: rowStatsA,
                    timeA: totalTimeA,
                    itemsA: totalItemsA,
                    scoreA: totalScoreA,
                    isInternalChoiceRow: false,
                    hasInternalChoice: subUnitItemsB.length > 0
                });

                // Add "Internal Choice" row for this subunit
                const rowStatsB = createStats();
                let totalTimeB = 0;
                let totalItemsB = 0;
                let totalScoreB = 0;

                subUnitItemsB.forEach(item => {
                    const score = item.marksPerQuestion * item.questionCount;
                    const cp = (item.cognitiveProcessB || item.cognitiveProcess) as CognitiveProcess;
                    const kl = (item.knowledgeLevelB || item.knowledgeLevel) as KnowledgeLevel;
                    const fmt = (item.itemFormatB || item.itemFormat) as ItemFormat;
                    addToStats(rowStatsB, cp, kl, fmt, score, item.questionCount);
                    totalTimeB += (item.time || 0);
                    totalItemsB += item.questionCount;
                    totalScoreB += score;
                });

                subUnitsData.push({
                    subUnitId: `${subUnit.id}-choice`,
                    subTopicName: 'Choice',
                    statsA: rowStatsB, // Reuse statsA field for rendering logic
                    timeA: totalTimeB,
                    itemsA: totalItemsB,
                    scoreA: totalScoreB,
                    isInternalChoiceRow: true,
                    hasInternalChoice: subUnitItemsB.length > 0
                });
            });

            unitsList.push({
                unitId: unit.id,
                unitNumber: unit.unitNumber,
                unitName: unit.name,
                learningObjective: unit.learningOutcomes || '-',
                subUnits: subUnitsData,
                unitTotalItems,
                unitTotalScore
            });
        });

        return unitsList;
    }, [blueprint, curriculum]);

    return { contentAreaRows, cpWeightage, klWeightage, formatWeightage, itemRows, matrixRows };
}
