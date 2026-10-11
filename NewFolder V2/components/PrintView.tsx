import React, { useState, useEffect } from 'react';
import { Blueprint, Curriculum, QuestionPaperType, Discourse } from '../types';
import { getBlueprintById, initDB } from '../services/db';
import { RefreshCw } from 'lucide-react';
import AnswerKeyView from './AnswerKeyView';
import { Report1 } from './Report1';
import { Report2 } from './Report2';
import { Report3 } from './Report3';
import { useReportData } from '../hooks/useReportData';

/**
 * PrintView Component
 * 
 * Strict A4 layout (210mm x 297mm)
 * Unified rendering engine for both Browser Print and Puppeteer Export.
 */
const PrintView: React.FC<{ id: string }> = ({ id }) => {
    const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [loading, setLoading] = useState(true);
    const [discourses, setDiscourses] = useState<Discourse[]>([]);

    const queryParams = new URLSearchParams(window.location.search);
    const currentTab = queryParams.get('tab') || 'report1';
    const renderMode = queryParams.get('mode') || 'admin';
    const isExportMode = queryParams.get('exportMode') === 'true';
    const showUserDraftWatermark = renderMode === 'user';

    useEffect(() => {
        const loadData = async () => {
            try {
                await initDB();
                const bp = await getBlueprintById(id);
                if (bp) {
                    setBlueprint(bp);
                    const db = await initDB();
                    const curr = db.curriculums.find(c => c.classLevel === bp.classLevel && c.subject === bp.subject);
                    setCurriculum(curr || null);
                    setDiscourses(db.discourses || []);
                }
            } catch (err) {
                console.error("Failed to load print data:", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id]);

    const reportData = useReportData(blueprint, curriculum, discourses);

    if (loading || !blueprint || !curriculum) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white">
                <RefreshCw className="animate-spin text-blue-600 mb-4" size={48} />
                <p className="text-gray-500 font-bold uppercase tracking-widest font-serif">Preparing {currentTab.toUpperCase()}...</p>
            </div>
        );
    }

    const getSettingsForTab = (tab: string) => {
        const isLandscapeDefault = (tab === 'report2' || tab === 'report3');
        const tabDefaults = {
            fontFamily: 'TAU-Paalai',
            fontFamilyEnglish: 'Georgia',
            fontSizeBody: 12,
            fontSizeTamil: 10,
            fontSizeEnglish: 11,
            orientation: isLandscapeDefault ? 'l' : 'p',
            paperSize: 'A4'
        };

        let localSettings: any = {};
        try {
            const stored = localStorage.getItem(`bp_settings_${id}_${tab}`);
            if (stored) localSettings = JSON.parse(stored);
        } catch (e) { }

        const perReport = (blueprint.perReportSettings?.[tab] || {}) as any;
        const globalSettings = blueprint.reportSettings || {};

        return {
            ...tabDefaults,
            ...globalSettings,
            ...perReport,
            ...localSettings,
            orientation: localSettings.orientation || perReport.orientation || (globalSettings as any).orientation || (isLandscapeDefault ? 'l' : 'p')
        };
    };

    const settings = getSettingsForTab(currentTab);
    const paperSize = settings.paperSize || 'A4';
    const orientation = settings.orientation || (currentTab === 'report2' || currentTab === 'report3' ? 'l' : 'p');

    return (
        <div className="bg-white min-h-screen print-root">
            <style dangerouslySetInnerHTML={{ __html: `
                @page {
                    size: ${paperSize === 'Legal' ? 'Legal' : 'A4'} ${orientation === 'l' ? 'landscape' : 'portrait'};
                    margin: ${orientation === 'l' ? '15mm 15mm 20mm 15mm' : '20mm 15mm 20mm 15mm'};
                }
                
                body { margin: 0; padding: 0; background: white; }

                .draft-watermark {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-45deg);
                    font-size: 80pt;
                    color: rgba(0,0,0,0.05);
                    z-index: 0;
                    pointer-events: none;
                    white-space: nowrap;
                    font-family: serif;
                    font-weight: bold;
                }

                @media print {
                    .no-print { display: none !important; }
                    .report-page {
                        box-shadow: none !important;
                        border: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    
                    /* Universal reset for natural document flow */
                    html, body, #root {
                        height: auto !important;
                        overflow: visible !important;
                    }

                    /* 
                       PRESERVE TAMIL SHAPING AND WORD INTEGRITY
                       - keep-all prevents breaking between characters
                       - line-break: strict ensures clusters stay together
                    */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        word-break: normal !important;
                        overflow-wrap: break-word !important;
                        line-break: strict !important;
                    }

                    .tamil-font, [lang="ta"] {
                        word-break: keep-all !important;
                        line-break: strict !important;
                        white-space: normal !important;
                    }

                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        page-break-inside: auto !important;
                    }

                    thead {
                        display: table-header-group !important;
                    }

                    tr {
                        page-break-inside: avoid !important;
                        page-break-after: auto !important;
                    }

                    tbody {
                        display: table-row-group !important;
                    }
                }
            ` }} />

            {showUserDraftWatermark && (
                <div className="draft-watermark">Blueprint Draft</div>
            )}

            <div className="print-content flex flex-col items-center">
                {(currentTab === 'report1' || currentTab === 'all') && (
                    <Report1 blueprint={blueprint} data={reportData} />
                )}

                {(currentTab === 'report2' || currentTab === 'all') && (
                    <Report2 blueprint={blueprint} data={reportData} />
                )}

                {(currentTab === 'report3' || currentTab === 'all') && (
                    <Report3 blueprint={blueprint} data={reportData} />
                )}

                {(currentTab === 'answerkey' || currentTab === 'all') && (
                    <AnswerKeyView 
                        blueprint={blueprint} 
                        curriculum={curriculum} 
                        discourses={discourses} 
                        settings={getSettingsForTab('answerkey')} 
                        isExportMode={isExportMode} 
                    />
                )}
            </div>
        </div>
    );
};

export default PrintView;
