/**
 * reportUtils.tsx
 *
 * Shared pure-utility functions and constants for PDF report generation.
 * Used by both PrintView.tsx and ReportsView.tsx to eliminate duplication.
 */
import React from 'react';
import { CognitiveProcess, KnowledgeLevel, ItemFormat } from '../types';

// ─── Definitions ────────────────────────────────────────────────────────────

export const cpDefinitions = [
    { key: 'CP1', label: 'Conceptual Clarity',    value: CognitiveProcess.CP1 },
    { key: 'CP2', label: 'Application Skill',      value: CognitiveProcess.CP2 },
    { key: 'CP3', label: 'Computational Thinking', value: CognitiveProcess.CP3 },
    { key: 'CP4', label: 'Analytical Thinking',    value: CognitiveProcess.CP4 },
    { key: 'CP5', label: 'Critical Thinking',      value: CognitiveProcess.CP5 },
    { key: 'CP6', label: 'Creative Thinking',      value: CognitiveProcess.CP6 },
    { key: 'CP7', label: 'Values/Attitudes',       value: CognitiveProcess.CP7 },
];

export const levelDefinitions = [
    { key: 'B', label: 'Basic Level',    value: KnowledgeLevel.BASIC },
    { key: 'A', label: 'Average Level',  value: KnowledgeLevel.AVERAGE },
    { key: 'P', label: 'Profound Level', value: KnowledgeLevel.PROFOUND },
];

export const formatDefinitions = [
    { key: 'SR1',  label: 'Multiple Choice Item', value: ItemFormat.SR1  },
    { key: 'SR2',  label: 'Matching Item',         value: ItemFormat.SR2  },
    { key: 'CRS1', label: 'VSA',                   value: ItemFormat.CRS1 },
    { key: 'CRS2', label: 'SA',                    value: ItemFormat.CRS2 },
    { key: 'CRL',  label: 'Essay',                 value: ItemFormat.CRL  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export type StatsRecord = Record<string, { count: number; score: number }>;
export type ReportStats = { cp: StatsRecord; levels: StatsRecord; formats: StatsRecord };

// ─── Stats helpers ───────────────────────────────────────────────────────────

export const createStats = (): ReportStats => ({
    cp:      Object.fromEntries(cpDefinitions.map(d    => [d.key, { count: 0, score: 0 }])) as StatsRecord,
    levels:  Object.fromEntries(levelDefinitions.map(d => [d.key, { count: 0, score: 0 }])) as StatsRecord,
    formats: Object.fromEntries(formatDefinitions.map(d => [d.key, { count: 0, score: 0 }])) as StatsRecord,
});

// ─── Normalise helpers ───────────────────────────────────────────────────────

export const normalizeValue = (
    stored: string,
    definitions: Array<{ key: string; value: string; label: string }>,
): string => {
    if (!stored) return '';
    const s = stored.toString().trim().toLowerCase();
    const clean = (str: string) => str.replace(/[^a-z0-9]/g, '');
    const sClean = clean(s);
    const byVal   = definitions.find(d => clean(d.value.toLowerCase()) === sClean);
    if (byVal)   return byVal.value;
    const byKey   = definitions.find(d => clean(d.key.toLowerCase()) === sClean);
    if (byKey)   return byKey.value;
    const byLabel = definitions.find(d => clean(d.label.toLowerCase()) === sClean);
    if (byLabel) return byLabel.value;
    return stored;
};

export const normalizeCPValue     = (s: string) => normalizeValue(s, cpDefinitions);
export const normalizeLevelValue  = (s: string) => normalizeValue(s, levelDefinitions);
export const normalizeFormatValue = (s: string) => normalizeValue(s, formatDefinitions);

// ─── addToStats ──────────────────────────────────────────────────────────────

export const addToStats = (
    stats:          ReportStats,
    cognitiveProcess: CognitiveProcess,
    knowledgeLevel:   KnowledgeLevel,
    itemFormat:       ItemFormat,
    score:            number,
    questionCount:    number = 1,
): void => {
    const cp  = normalizeCPValue(cognitiveProcess as string)  as CognitiveProcess;
    const lv  = normalizeLevelValue(knowledgeLevel as string) as KnowledgeLevel;
    const fmt = normalizeFormatValue(itemFormat as string)    as ItemFormat;
    const cpKey  = cpDefinitions.find(d => d.value === cp)?.key;
    const lvKey  = levelDefinitions.find(d => d.value === lv)?.key;
    const fmtKey = formatDefinitions.find(d => d.value === fmt)?.key;
    if (cpKey)  { stats.cp[cpKey].count  += questionCount; stats.cp[cpKey].score  += score; }
    if (lvKey)  { stats.levels[lvKey].count  += questionCount; stats.levels[lvKey].score  += score; }
    if (fmtKey) { stats.formats[fmtKey].count += questionCount; stats.formats[fmtKey].score += score; }
};

// ─── formatMark ──────────────────────────────────────────────────────────────

export const formatMark = (m: number): React.ReactElement => {
    const s = m.toString();
    let result = s;
    if (s.endsWith('.5')) {
        const whole = s.split('.')[0];
        result = whole === '0' ? '½' : `${whole}½`;
    }
    return <span className="english-font" style={{ fontFamily: "'Times New Roman', serif" }}>{result}</span>;
};
