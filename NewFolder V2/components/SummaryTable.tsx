import React from 'react';
import { BlueprintItem, ItemFormat, KnowledgeLevel, CognitiveProcess } from '@/types';
import { LayoutDashboard } from 'lucide-react';

export const SummaryTable = ({ items = [] }: { items?: BlueprintItem[] }) => {
    if (!items || items.length === 0) return null;
    const totalMarks = items.reduce((acc, item) => acc + item.totalMarks, 0);

    // 1. Format Stats
    const formatStats = items.reduce((acc, item) => {
        // Count Option A
        if (!acc[item.itemFormat]) acc[item.itemFormat] = { count: 0, marks: 0 };
        acc[item.itemFormat].count += item.questionCount;
        acc[item.itemFormat].marks += item.totalMarks;

        // Count Option B if exists
        if (item.hasInternalChoice) {
            const fmtB = item.itemFormatB || item.itemFormat;
            if (!acc[fmtB]) acc[fmtB] = { count: 0, marks: 0 };
            acc[fmtB].count += item.questionCount;
            acc[fmtB].marks += item.totalMarks;
        }
        return acc;
    }, {} as Record<string, { count: number, marks: number }>);

    // 2. Knowledge Level Stats
    const knowledgeStats = items.reduce((acc, item) => {
        // Count Option A
        const keyA = item.knowledgeLevel || 'Unknown';
        if (!acc[keyA]) acc[keyA] = { count: 0, marks: 0 };
        acc[keyA].count += item.questionCount;
        acc[keyA].marks += item.totalMarks;

        // Count Option B if exists
        if (item.hasInternalChoice) {
            const keyB = item.knowledgeLevelB || item.knowledgeLevel || 'Unknown';
            if (!acc[keyB]) acc[keyB] = { count: 0, marks: 0 };
            acc[keyB].count += item.questionCount;
            acc[keyB].marks += item.totalMarks;
        }
        return acc;
    }, {} as Record<string, { count: number, marks: number }>);

    // 3. Cognitive Process Stats
    const cognitiveStats = items.reduce((acc, item) => {
        // Count Option A
        const cpCodeA = item.cognitiveProcess?.split(' ')[0] || 'N/A';
        if (!acc[cpCodeA]) acc[cpCodeA] = { count: 0, marks: 0 };
        acc[cpCodeA].count += item.questionCount;
        acc[cpCodeA].marks += item.totalMarks;

        // Count Option B if exists
        if (item.hasInternalChoice) {
            const cpCodeB = (item.cognitiveProcessB || item.cognitiveProcess)?.split(' ')[0] || 'N/A';
            if (!acc[cpCodeB]) acc[cpCodeB] = { count: 0, marks: 0 };
            acc[cpCodeB].count += item.questionCount;
            acc[cpCodeB].marks += item.totalMarks;
        }
        return acc;
    }, {} as Record<string, { count: number, marks: number }>);

    // 4. Option Stats
    const optionStats = items.reduce((acc, item) => {
        const key = item.hasInternalChoice ? 'With Choice' : 'Without Choice';
        if (!acc[key]) acc[key] = { count: 0, marks: 0 };
        acc[key].count += item.questionCount;
        acc[key].marks += item.totalMarks;
        return acc;
    }, {} as Record<string, { count: number, marks: number }>);

    const StatTable = ({ title, data }: { title: string, data: Record<string, { count: number, marks: number }> }) => (
        <div className="bg-white flex-1 min-w-[200px] overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-gray-100 border-b">
                        <th className="p-2 text-left font-bold text-gray-700 uppercase tracking-wider">{title}</th>
                        <th className="p-2 text-center font-bold text-gray-700 w-16">Qns</th>
                        <th className="p-2 text-center font-bold text-gray-700 w-16">Marks</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(data).sort((a, b) => b[0].localeCompare(a[0])).map(([key, stat]) => (
                        <tr key={key} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="p-2 font-medium text-gray-800">{key}</td>
                            <td className="p-2 text-center text-gray-600 border-l">{stat.count}</td>
                            <td className="p-2 text-center text-gray-900 font-bold border-l">{stat.marks}</td>
                        </tr>
                    ))}
                    {Object.keys(data).length === 0 && (
                        <tr><td colSpan={3} className="p-4 text-center text-gray-400 italic">No data</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="mt-8 no-print animate-fade-in text-black">
            <h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <LayoutDashboard size={16} className="text-blue-600" /> Blueprint Summary
                <span className="ml-auto bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-bold shadow-sm border border-green-200">
                    Grand Total: {items.length} Items | {totalMarks} Marks
                </span>
            </h4>
            <div className="flex gap-4 items-start flex-wrap">
                <StatTable title="Knowledge Level" data={knowledgeStats} />
                <StatTable title="Item Format" data={formatStats} />
                <StatTable title="Cognitive Process" data={cognitiveStats} />
                <StatTable title="Option/Choice" data={optionStats} />
            </div>
        </div>
    );
};
