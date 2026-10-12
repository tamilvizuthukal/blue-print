import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { Blueprint, Curriculum, BlueprintItem, QuestionPaperType, Discourse, ReportSettings } from '@/types';
import { Download, FileText, Settings, X, Check, BarChart3, ChartNoAxesCombined, ClipboardList } from 'lucide-react';
import { runBulkExportAndMerge } from '../services/pdfExportService';
import AnswerKeyView from './AnswerKeyView';
import { Report1 } from './Report1';
import { Report2 } from './Report2';
import { Report3 } from './Report3';
import { useReportData } from '@/hooks/useReportData';

interface ReportsViewProps {
    blueprint: Blueprint;
    curriculum: Curriculum;
    discourses?: Discourse[];
    paperType?: QuestionPaperType;
    onDownloadPDF: (tab: string) => void;
    onDownloadWord: (tab: string) => void;
    isAdmin?: boolean;
    isWebmaster?: boolean;
    confirmedReports?: Record<string, boolean>;
    onConfirmReport?: (reportId: string) => Promise<void> | void;
    onUpdateReportSettings?: (settings: Blueprint['reportSettings'], perReport?: Blueprint['perReportSettings']) => void;
    onSaveSettings?: () => Promise<void>;
    onMoveItem?: (itemId: string, newUnitId: string, newSectionId: string, newSubUnitId?: string) => void;
    onUpdateItemField?: (id: string, field: keyof BlueprintItem, val: any) => void;
    onConfirmAnswerKey?: () => void;
    defaultTab?: string;
    fitMobileA4?: boolean;
}

export const ReportsView = ({
    blueprint,
    curriculum,
    discourses = [],
    paperType,
    onDownloadPDF,
    onDownloadWord,
    isAdmin = false,
    isWebmaster = false,
    confirmedReports = {},
    onConfirmReport,
    onUpdateReportSettings,
    onSaveSettings,
    onMoveItem,
    onUpdateItemField,
    onConfirmAnswerKey,
    defaultTab = 'report1',
    fitMobileA4 = false
}: ReportsViewProps) => {
    const [activeTab, setActiveTab] = useState(defaultTab);
    const previewViewportRef = React.useRef<HTMLDivElement>(null);
    const [previewViewportWidth, setPreviewViewportWidth] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isExportingAll, setIsExportingAll] = useState(false);
    const [isConfirmingReport, setIsConfirmingReport] = useState(false);

    React.useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        }
    }, [defaultTab]);

    React.useEffect(() => {
        if (!fitMobileA4 || !previewViewportRef.current) return;
        const viewport = previewViewportRef.current;
        const updateWidth = () => setPreviewViewportWidth(viewport.clientWidth);
        updateWidth();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateWidth);
            return () => window.removeEventListener('resize', updateWidth);
        }
        const observer = new ResizeObserver(updateWidth);
        observer.observe(viewport);
        return () => observer.disconnect();
    }, [fitMobileA4]);

    const reportData = useReportData(blueprint, curriculum, discourses);

    const handleSave = async () => {
        try {
            if (blueprint.perReportSettings) {
                Object.entries(blueprint.perReportSettings).forEach(([tab, s]) => {
                    localStorage.setItem(`bp_settings_${blueprint.id}_${tab}`, JSON.stringify(s));
                });
            }
            localStorage.setItem(`bp_settings_${blueprint.id}_${activeTab}`, JSON.stringify(settings));
        } catch (e) {
            console.error("Failed to save to localStorage", e);
        }

        if (onSaveSettings) {
            setIsSavingSettings(true);
            try {
                await onSaveSettings();
                setIsSettingsOpen(false);
                Swal.fire({
                    title: 'Settings Saved',
                    text: 'Settings have been saved successfully.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            } catch (error) {
                console.error("Failed to save settings:", error);
                Swal.fire("Error", "Failed to save settings to database.", "error");
            } finally {
                setIsSavingSettings(false);
            }
        } else {
            setIsSettingsOpen(false);
            Swal.fire({
                title: 'Settings Applied',
                text: 'Settings applied locally for this session.',
                icon: 'info',
                timer: 1500,
                showConfirmButton: false
            });
        }
    };

    const defaultSettings: ReportSettings = {
        fontFamily: 'TAU-Paalai',
        fontFamilyEnglish: 'Georgia',
        headerFontStyle: 'Syne',
        fontSizeBody: 12,
        fontSizeTamil: 12,
        fontSizeEnglish: 11,
        fontSizeTitle: 14,
        lineHeight: 1.2,
        rowHeight: 35,
        columnWidths: {},
        showLogo: true,
        compactMode: false,
        orientation: 'p',
        paperSize: 'A4',
        contentFontSize: 10,
        otherFontSize: 11
    };

    const getSettingsForTab = (tab: string): ReportSettings => {
        let localSettings: Partial<ReportSettings> = {};
        try {
            const stored = localStorage.getItem(`bp_settings_${blueprint.id}_${tab}`);
            if (stored) localSettings = JSON.parse(stored);
        } catch (e) { }

        const defaultOrient = (tab === 'report2' || tab === 'report3') ? 'l' : 'p';
        const globalOrient = blueprint.reportSettings?.orientation;
        const perReportOrient = localSettings.orientation || blueprint.perReportSettings?.[tab]?.orientation;
        const perReport = blueprint.perReportSettings?.[tab];

        return {
            ...defaultSettings,
            ...blueprint.reportSettings,
            ...localSettings,
            ...perReport,
            orientation: perReportOrient || globalOrient || defaultOrient
        };
    };

    const settings = getSettingsForTab(activeTab);
  const a4PreviewWidth = activeTab === 'report2' || activeTab === 'report3' ? 1122.52 : 793.7;
    const a4PreviewScale = fitMobileA4 && previewViewportWidth > 0
        ? Math.min(1, previewViewportWidth / a4PreviewWidth)
        : 1;

    const handleDownloadWord = (tab: string) => {
        if (onDownloadWord) {
            onDownloadWord(tab === 'answerkey' ? 'answerKey' : tab);
        } else {
            Swal.fire("Error", "Word export is not available in this view.", "error");
        }
    };

    const handleExportAllPDFs = async () => {
        setIsExportingAll(true);
        try {
            await runBulkExportAndMerge(blueprint, curriculum, isAdmin || isWebmaster, true);
        } finally {
            setIsExportingAll(false);
        }
    };

    const handleConfirmReport = async () => {
        if (!onConfirmReport || !['report1', 'report2', 'report3'].includes(activeTab) || confirmedReports[activeTab]) return;
        setIsConfirmingReport(true);
        try {
            await onConfirmReport(activeTab);
        } finally {
            setIsConfirmingReport(false);
        }
    };

    const tabs = [
        { id: 'report1', label: 'Report 1', icon: <FileText size={16} /> },
        { id: 'report2', label: 'Report 2', icon: <BarChart3 size={16} /> },
        { id: 'report3', label: 'Report 3', icon: <ChartNoAxesCombined size={16} /> },
        { id: 'answerkey', label: 'Answer Key', icon: <ClipboardList size={16} /> }
    ];

    return (
        <div className="mt-10 w-full text-black reports-container relative">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .reports-container {
                        overflow: visible !important;
                        position: static !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .reports-visible-content {
                        overflow: visible !important;
                        height: auto !important;
                    }
                    .sticky {
                        position: static !important;
                    }
                }
                
                @media screen {
                    .landscape {
                        transform: scale(0.9);
                        transform-origin: top center;
                        margin-bottom: -100px;
                    }
                }
            ` }} />
            
            <div className="reports-toolbar sticky top-[72px] md:top-[76px] z-20 bg-white py-4 mb-4 no-print border-b flex justify-center items-center gap-4 flex-wrap px-4 shadow-sm">
                <div className="reports-tab-list flex bg-gray-100 p-1 border border-black/20 overflow-x-auto rounded-xl" role="tablist" aria-label="Report pages">
                    {tabs.map(tab => (
                        <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`reports-tab-button px-4 py-2 font-bold transition-all text-sm md:text-base whitespace-nowrap rounded-lg ${activeTab === tab.id ? 'bg-black text-white shadow-md' : 'text-gray-700 hover:bg-gray-200'}`}>
                            <span className="reports-tab-icon" aria-hidden="true">{tab.icon}</span>
                            <span className="reports-tab-label">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 items-center">
                    {isWebmaster && activeTab !== 'answerkey' && (
                        <button
                            onClick={handleConfirmReport}
                            disabled={isConfirmingReport || !!confirmedReports[activeTab] || !onConfirmReport}
                            title={confirmedReports[activeTab] ? 'This report is confirmed' : `Confirm ${activeTab}`}
                            className={`border-0 p-2 transition-all flex items-center gap-1.5 rounded-lg text-xs font-bold px-3 ${confirmedReports[activeTab] ? 'bg-emerald-100 text-emerald-800 cursor-default' : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60'}`}
                            style={{ height: '40px' }}
                        >
                            <Check size={16} />
                            <span>{confirmedReports[activeTab] ? 'Confirmed' : isConfirmingReport ? 'Confirming…' : 'Confirm Report'}</span>
                        </button>
                    )}
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => onDownloadPDF(activeTab)}
                                title="High Quality PDF (Export)"
                                className="bg-red-600 hover:bg-red-700 text-white border-0 p-2 transition-all flex items-center gap-1.5 rounded-lg text-xs font-bold px-3"
                                style={{ height: '40px' }}
                            >
                                <Download size={16} />
                                <span className="hidden sm:inline">HQ PDF</span>
                            </button>
                            <button
                                onClick={() => handleDownloadWord(activeTab)}
                                title="Export as Word Document"
                                className="bg-blue-700 hover:bg-blue-800 text-white border-0 p-2 transition-all flex items-center gap-1.5 rounded-lg text-xs font-bold px-3"
                                style={{ height: '40px' }}
                            >
                                <FileText size={16} />
                                <span className="hidden sm:inline">Word</span>
                            </button>
                            <button onClick={() => setIsSettingsOpen(true)} className="bg-gray-100 text-black border border-gray-300 p-2 hover:bg-gray-200 transition-all rounded-lg flex items-center justify-center" style={{ width: '40px', height: '40px' }}><Settings size={18} /></button>
                        </>
                    )}
                    {(isAdmin || isWebmaster) && (
                        <button
                            onClick={handleExportAllPDFs}
                            disabled={isExportingAll}
                            title="Export Report 1, Report 2, Report 3 and Answer Key as one PDF"
                            className={`${isExportingAll ? 'bg-red-400 cursor-not-allowed' : 'bg-rose-700 hover:bg-rose-800'} text-white border-0 p-2 transition-all flex items-center gap-1.5 rounded-lg text-xs font-bold px-3`}
                            style={{ height: '40px' }}
                        >
                            <Download size={16} />
                            <span>{isExportingAll ? 'Exporting…' : 'All Reports PDF'}</span>
                        </button>
                    )}
                </div>
            </div>

            <div ref={previewViewportRef} className="reports-preview-viewport w-full overflow-x-auto custom-scrollbar">
                <div className="reports-visible-content flex flex-col items-center" style={{
                    fontFamily: `${settings.fontFamilyEnglish || 'Georgia'}, ${settings.fontFamily}, serif`,
                    fontSize: `${settings.fontSizeBody}pt`,
                    height: 'auto !important',
                    overflow: 'visible !important'
                }}>
                    {activeTab === 'report3' && <Report3 blueprint={blueprint} data={reportData} />}
                    {activeTab === 'report2' && <div className={`mobile-a4-preview is-landscape ${fitMobileA4 ? 'is-mobile-fit' : ''}`} style={fitMobileA4 ? { zoom: a4PreviewScale } : undefined}><Report2 blueprint={blueprint} data={reportData} /></div>}
                    {activeTab === 'report1' && <div className={`mobile-a4-preview is-portrait ${fitMobileA4 ? 'is-mobile-fit' : ''}`} style={fitMobileA4 ? { zoom: a4PreviewScale } : undefined}><Report1 blueprint={blueprint} data={reportData} /></div>}
                    {activeTab === 'answerkey' && (
                        <div className="flex-1 w-full overflow-auto">
                            <AnswerKeyView blueprint={blueprint} curriculum={curriculum} discourses={discourses} isExportMode={false} settings={getSettingsForTab('answerkey')} onConfirmAnswerKey={onConfirmAnswerKey} />
                        </div>
                    )}
                </div>
            </div>

            {isSettingsOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Settings className="text-blue-600" size={20} />
                                Report Settings
                            </h3>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Paper Size</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-bold"
                                        value={settings.paperSize || 'A4'}
                                        onChange={(e) => {
                                            const newVal = e.target.value as 'A4' | 'Legal';
                                            const updatedSettings = { ...settings, paperSize: newVal };
                                            const newPer = { ...(blueprint.perReportSettings || {}), [activeTab]: updatedSettings };
                                            try { localStorage.setItem(`bp_settings_${blueprint.id}_${activeTab}`, JSON.stringify(updatedSettings)); } catch (err) { }
                                            onUpdateReportSettings && onUpdateReportSettings(blueprint.reportSettings, newPer);
                                        }}
                                    >
                                        <option value="A4">A4</option><option value="Legal">Legal</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Orientation</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-bold"
                                        value={settings.orientation || 'p'}
                                        onChange={(e) => {
                                            const newVal = e.target.value as 'p' | 'l';
                                            const updatedSettings = { ...settings, orientation: newVal };
                                            const newPer = { ...(blueprint.perReportSettings || {}), [activeTab]: updatedSettings };
                                            try { localStorage.setItem(`bp_settings_${blueprint.id}_${activeTab}`, JSON.stringify(updatedSettings)); } catch (err) { }
                                            onUpdateReportSettings && onUpdateReportSettings(blueprint.reportSettings, newPer);
                                        }}
                                    >
                                        <option value="p">Portrait</option><option value="l">Landscape</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Tamil Font</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-bold"
                                        value={settings.fontFamily}
                                        onChange={(e) => {
                                            const updatedSettings = { ...settings, fontFamily: e.target.value };
                                            const newPer = { ...(blueprint.perReportSettings || {}), [activeTab]: updatedSettings };
                                            try { localStorage.setItem(`bp_settings_${blueprint.id}_${activeTab}`, JSON.stringify(updatedSettings)); } catch (err) { }
                                            onUpdateReportSettings && onUpdateReportSettings(blueprint.reportSettings, newPer);
                                        }}
                                    >
                                        <option value="TAU-Paalai">TAU-Paalai</option>
                                        <option value="Latha">Latha</option>
                                        <option value="TAU-Achu">TAU-Achu</option>
                                        <option value="TAU-Ezhil">TAU-Ezhil</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Tamil Font Size</label>
                                    <input
                                        type="number" step="0.5"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-bold"
                                        value={settings.fontSizeTamil || 12}
                                        onChange={(e) => {
                                            const updatedSettings = { ...settings, fontSizeTamil: parseFloat(e.target.value) };
                                            const newPer = { ...(blueprint.perReportSettings || {}), [activeTab]: updatedSettings };
                                            try { localStorage.setItem(`bp_settings_${blueprint.id}_${activeTab}`, JSON.stringify(updatedSettings)); } catch (err) { }
                                            onUpdateReportSettings && onUpdateReportSettings(blueprint.reportSettings, newPer);
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">English Font</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-bold"
                                        value={settings.fontFamilyEnglish || 'Times New Roman'}
                                        onChange={(e) => {
                                            const updatedSettings = { ...settings, fontFamilyEnglish: e.target.value };
                                            const newPer = { ...(blueprint.perReportSettings || {}), [activeTab]: updatedSettings };
                                            try { localStorage.setItem(`bp_settings_${blueprint.id}_${activeTab}`, JSON.stringify(updatedSettings)); } catch (err) { }
                                            onUpdateReportSettings && onUpdateReportSettings(blueprint.reportSettings, newPer);
                                        }}
                                    >
                                        <option value="Times New Roman">Times New Roman</option>
                                        <option value="Georgia">Georgia</option>
                                        <option value="Arial">Arial</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">English Font Size</label>
                                    <input
                                        type="number" step="0.5"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-bold"
                                        value={settings.fontSizeEnglish || settings.fontSizeBody || 11}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            const updatedSettings = { ...settings, fontSizeEnglish: val, fontSizeBody: val };
                                            const newPer = { ...(blueprint.perReportSettings || {}), [activeTab]: updatedSettings };
                                            try { localStorage.setItem(`bp_settings_${blueprint.id}_${activeTab}`, JSON.stringify(updatedSettings)); } catch (err) { }
                                            onUpdateReportSettings && onUpdateReportSettings(blueprint.reportSettings, newPer);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                            <button onClick={() => setIsSettingsOpen(false)} className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-200">Cancel</button>
                            <button onClick={handleSave} disabled={isSavingSettings} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 transition-all shadow-lg shadow-blue-100 disabled:opacity-50">
                                {isSavingSettings ? 'Saving...' : <><Check size={20} /> Save Settings</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
