import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Save, Loader2, Key, Calendar, Eye, EyeOff, Sparkles, Settings, Database, Download, Upload, AlertTriangle, FileJson } from 'lucide-react';
import { getAppSettings, saveAppSettings, AppSettings, getCurrentAcademicYear, exportDatabase, importDatabase } from '../services/db';

const AdminAppSettingsManager = () => {
    const [settings, setSettings] = useState<AppSettings>({ 
        ollamaEndpoint: 'http://127.0.0.1:11434', 
        ollamaModel: 'gemma3:12b', 
        academicYear: getCurrentAcademicYear(),
        enablePublicSpellCheck: true
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showKey, setShowKey] = useState(false);

    // Database management states
    const [exportType, setExportType] = useState<'all' | 'blueprints' | 'users'>('all');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [detectedType, setDetectedType] = useState<string | null>(null);
    const [importData, setImportData] = useState<any>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const data = await exportDatabase(exportType);
            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
                JSON.stringify(data, null, 2)
            )}`;
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', jsonString);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            downloadAnchor.setAttribute(
                'download',
                `blueprint_backup_${exportType}_${timestamp}.json`
            );
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();

            Swal.fire({
                title: "Export Successful!",
                text: "Backup file downloaded successfully.",
                icon: "success",
                confirmButtonColor: "#4f46e5",
                confirmButtonText: "OK"
            });
        } catch (err) {
            console.error("Failed to export database:", err);
            Swal.fire("Error", "Failed to export database", "error");
        } finally {
            setIsExporting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            setImportFile(null);
            setDetectedType(null);
            setImportData(null);
            return;
        }

        setImportFile(file);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                setImportData(parsed);

                // Detect type
                if (parsed.type) {
                    if (parsed.type === 'all') {
                        setDetectedType('Full Backup (All Collections)');
                    } else if (parsed.type === 'blueprints') {
                        setDetectedType('Blueprints & Shares');
                    } else if (parsed.type === 'users') {
                        setDetectedType('Users Data');
                    } else {
                        setDetectedType(`Custom JSON (${parsed.type})`);
                    }
                } else if (Array.isArray(parsed)) {
                    if (parsed.length > 0 && parsed[0].username) {
                        setDetectedType('Users Data (Raw Array)');
                    } else if (parsed.length > 0 && parsed[0].ownerId) {
                        setDetectedType('Blueprints Data (Raw Array)');
                    } else {
                        setDetectedType('Raw JSON Array');
                    }
                } else {
                    setDetectedType('JSON Object');
                }
            } catch (err) {
                console.error("JSON parse error:", err);
                setDetectedType('Invalid JSON File');
                setImportData(null);
            }
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (!importData || !importFile) return;

        let typeToSend: 'all' | 'blueprints' | 'users' = 'all';
        if (detectedType?.includes('Users')) {
            typeToSend = 'users';
        } else if (detectedType?.includes('Blueprints')) {
            typeToSend = 'blueprints';
        } else if (detectedType?.includes('Full Backup') || detectedType === 'all') {
            typeToSend = 'all';
        }

        const confirm = await Swal.fire({
            title: 'Import Database?',
            text: `Type: ${detectedType || 'Unknown'}. This will update/upsert records with data from this backup file. Continue?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, Import',
            cancelButtonText: 'Cancel'
        });

        if (!confirm.isConfirmed) return;

        setIsImporting(true);
        try {
            const res = await importDatabase(typeToSend, importData);

            let summaryHtml = '<ul class="list-disc pl-4 space-y-1 text-slate-700 font-bold text-xs">';
            if (res.summary) {
                Object.entries(res.summary).forEach(([col, count]) => {
                    summaryHtml += `<li>${col}: ${count}</li>`;
                });
            }
            summaryHtml += '</ul>';

            Swal.fire({
                title: "Import Successful!",
                html: `<div class="text-left"><p class="mb-3">Database backup successfully imported.</p>${summaryHtml}</div>`,
                icon: "success",
                confirmButtonColor: "#4f46e5",
                confirmButtonText: "சரி (OK)"
            });

            setImportFile(null);
            setDetectedType(null);
            setImportData(null);

            const fileInput = document.getElementById('database-file-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

        } catch (err: any) {
            console.error("Failed to import database:", err);
            Swal.fire("Error", `Failed to import database: ${err.message || err}`, "error");
        } finally {
            setIsImporting(false);
        }
    };

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getAppSettings();
                setSettings({
                    ollamaEndpoint: data?.ollamaEndpoint || 'http://127.0.0.1:11434',
                    ollamaModel: data?.ollamaModel || 'gemma3:12b',
                    academicYear: data?.academicYear || getCurrentAcademicYear(),
                    enablePublicSpellCheck: data?.enablePublicSpellCheck !== false
                });
            } catch (err) {
                console.error("Failed to load settings:", err);
                Swal.fire("Error", "Failed to load settings", "error");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await saveAppSettings(settings);
            Swal.fire({
                title: "Success!",
                text: "Settings saved successfully.",
                icon: "success",
                confirmButtonColor: "#4f46e5",
                confirmButtonText: "OK"
            });
        } catch (err) {
            console.error("Failed to save settings:", err);
            Swal.fire("Error", "Failed to save settings", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
                <p className="text-gray-500 font-bold text-sm">Loading Settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            {/* App Settings Card */}
            <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-xl shadow-indigo-50/20 overflow-hidden transition-all duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 p-8 text-white relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg">
                            <Settings size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight font-sans">App Settings</h2>
                            <p className="text-indigo-200 text-xs font-bold mt-1 uppercase tracking-widest">System Configurations</p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="p-8 space-y-8">
                    {/* Ollama Configurations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-wider">
                                <Database size={16} className="text-indigo-600" />
                                Ollama URL / Endpoint (எண்ட் பாயிண்ட்)
                            </label>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                லோக்கல் ஓலாமா சேவையின் URL முகவரி. (Default: http://127.0.0.1:11434)
                            </p>
                            <input
                                type="text"
                                value={settings.ollamaEndpoint}
                                onChange={e => setSettings({ ...settings, ollamaEndpoint: e.target.value })}
                                placeholder="http://127.0.0.1:11434"
                                className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-bold text-slate-800 bg-slate-50/50 focus:bg-white"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-wider">
                                <Sparkles size={16} className="text-indigo-600" />
                                Ollama Model Name (மாடல் பெயர்)
                            </label>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                பயன்படுத்த வேண்டிய லோக்கல் AI மாடலின் பெயர். (Default: gemma3:12b)
                            </p>
                            <input
                                type="text"
                                value={settings.ollamaModel}
                                onChange={e => setSettings({ ...settings, ollamaModel: e.target.value })}
                                placeholder="gemma3:12b"
                                className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-bold text-slate-800 bg-slate-50/50 focus:bg-white"
                            />
                        </div>
                    </div>

                    <div className="h-px bg-gray-100"></div>

                    {/* Academic Year */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-wider">
                            <Calendar size={16} className="text-indigo-600" />
                            Academic Year
                        </label>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed">
                            Enter the default academic year to be used for newly created question papers.
                        </p>
                        <input
                            type="text"
                            value={settings.academicYear}
                            onChange={e => setSettings({ ...settings, academicYear: e.target.value })}
                            placeholder="e.g. 2026-27"
                            className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-sans text-sm font-bold text-slate-800 bg-slate-50/50 focus:bg-white"
                        />
                    </div>

                    <div className="h-px bg-gray-100"></div>

                    {/* Public Spell Check Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50/80 border border-slate-100 rounded-2xl">
                        <div className="space-y-1">
                            <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-wider">
                                <Sparkles size={16} className="text-indigo-600" />
                                Public Spell Check Button (லாகின் பக்க பிழைத்திருத்தி)
                            </label>
                            <p className="text-xs text-gray-500 font-medium">
                                லாகின் பக்கத்தின் மேல்பகுதியில் "Spell Check" பொத்தானைக் காட்டு / மறை (Show or hide the public Spell Check button on the login page).
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, enablePublicSpellCheck: !settings.enablePublicSpellCheck })}
                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.enablePublicSpellCheck ? 'bg-indigo-600' : 'bg-slate-300'}`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${settings.enablePublicSpellCheck ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>

                    {/* Info Box */}
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-4 shadow-inner">
                        <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700">
                            <Sparkles size={18} className="animate-pulse" />
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">Important Note</h4>
                            <p className="text-xs text-indigo-700/80 font-bold mt-1 leading-relaxed">
                                Saved settings apply immediately. Changing the academic year will apply to all newly created blueprints.
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-wait cursor-pointer"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {isSaving ? "Saving..." : "Save Settings"}
                        </button>
                    </div>
                </form>
            </div>

            {/* Database Management Card */}
            <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-xl shadow-indigo-50/20 overflow-hidden transition-all duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-indigo-950 p-8 text-white relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg">
                            <Database size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight font-sans">Database Management</h2>
                            <p className="text-slate-300 text-xs font-bold mt-1 uppercase tracking-widest">Backup & Restore Collections</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Export Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                            <Download size={16} className="text-slate-600" />
                            Export Backup
                        </h3>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed">
                            Select the section of the database you wish to backup and click 'Export Data' to download the JSON backup.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                            <select
                                value={exportType}
                                onChange={(e) => setExportType(e.target.value as any)}
                                className="flex-1 px-4 py-3.5 border-2 border-slate-100 rounded-2xl focus:border-slate-500 focus:ring-4 focus:ring-slate-50 outline-none transition-all font-sans text-sm font-bold text-slate-800 bg-slate-50/50"
                            >
                                <option value="all">Full Backup - All Collections</option>
                                <option value="blueprints">Blueprints & Share Metadata</option>
                                <option value="users">Users Database only</option>
                            </select>
                            <button
                                type="button"
                                onClick={handleExport}
                                disabled={isExporting}
                                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-700 text-white rounded-2xl font-black text-sm hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-wait cursor-pointer whitespace-nowrap"
                            >
                                {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                                {isExporting ? "Exporting" : "Export Data"}
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100"></div>

                    {/* Import Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                            <Upload size={16} className="text-slate-600" />
                            Import Backup
                        </h3>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed">
                            Select a previously exported JSON backup file to restore database collections.
                        </p>

                        <div className="space-y-4">
                            <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 transition-colors bg-slate-50/30 flex flex-col items-center justify-center text-center">
                                <input
                                    id="database-file-input"
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <FileJson size={36} className="text-slate-400 mb-2" />
                                <p className="text-sm font-bold text-gray-700">
                                    {importFile ? importFile.name : "Click to select JSON file"}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {importFile ? `Size: ${(importFile.size / 1024).toFixed(2)} KB` : "Supports only .json files"}
                                </p>
                            </div>

                            {detectedType && (
                                <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${detectedType.includes('Invalid') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'}`}>
                                    <span>Detected Type:</span>
                                    <span className="bg-white px-2 py-0.5 rounded shadow-sm font-mono">{detectedType}</span>
                                </div>
                            )}

                            {/* Warning Box */}
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
                                <div className="p-2 bg-amber-100 rounded-xl text-amber-800">
                                    <AlertTriangle size={18} className="animate-bounce" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">Warning</h4>
                                    <p className="text-xs text-amber-800/95 font-bold mt-1 leading-relaxed">
                                        Importing will overwrite/upsert existing database records matching the identifiers in the file.
                                    </p>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleImport}
                                    disabled={isImporting || !importData || !importFile}
                                    className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {isImporting ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                                    {isImporting ? "Importing" : "Import Data"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminAppSettingsManager;
