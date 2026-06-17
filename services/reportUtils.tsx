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
    { key: 'SR1',  label: 'Selected Response 1 (Objective)', value: ItemFormat.SR1  },
    { key: 'SR2',  label: 'Selected Response 2 (Objective)', value: ItemFormat.SR2  },
    { key: 'CRS1', label: 'Short Answer (2M - 1/2 lines)',    value: ItemFormat.CRS1 },
    { key: 'CRS2', label: 'Medium Answer (3-4M)',           value: ItemFormat.CRS2 },
    { key: 'CRL',  label: 'Essay Type (5-6M)',              value: ItemFormat.CRL  },
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
    
    // 1. Exact match with value (clean)
    const byVal   = definitions.find(d => clean(d.value.toLowerCase()) === sClean);
    if (byVal)   return byVal.value;
    
    // 2. Exact match with key (clean)
    const byKey   = definitions.find(d => clean(d.key.toLowerCase()) === sClean);
    if (byKey)   return byKey.value;
    
    // 3. Exact match with label (clean)
    const byLabel = definitions.find(d => clean(d.label.toLowerCase()) === sClean);
    if (byLabel) return byLabel.value;

    // 4. Partial match - if stored contains key or label (clean)
    // Sort by key length descending so more specific keys (e.g. 'CRS1') match before shorter ones (e.g. 'SR1')
    const sortedDefs = [...definitions].sort((a, b) => b.key.length - a.key.length);
    const byKeyPart = sortedDefs.find(d => sClean.includes(clean(d.key.toLowerCase())));
    if (byKeyPart) return byKeyPart.value;

    // 5. Special case for common variations
    if (definitions === formatDefinitions) {
        if (sClean.includes('matching')) return ItemFormat.SR2;
        if (sClean.includes('multiplechoice')) return ItemFormat.SR1;
        if (sClean.includes('vsa')) return ItemFormat.CRS1;
        if (sClean.includes('sa')) return ItemFormat.CRS2;
        if (sClean.includes('essay')) return ItemFormat.CRL;
    }
    
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
