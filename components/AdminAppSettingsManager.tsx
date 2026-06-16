import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Save, Loader2, Key, Calendar, Eye, EyeOff, Sparkles, Settings } from 'lucide-react';
import { getAppSettings, saveAppSettings, AppSettings } from '../services/db';

const AdminAppSettingsManager = () => {
    const [settings, setSettings] = useState<AppSettings>({ geminiApiKey: '', academicYear: '2026-27' });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getAppSettings();
                setSettings(data || { geminiApiKey: '', academicYear: '2026-27' });
            } catch (err) {
                console.error("Failed to load settings:", err);
                Swal.fire("Error", "அமைப்புகளை ஏற்றவதில் தோல்வி (Failed to load settings)", "error");
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
                title: "வெற்றி! (Success!)",
                text: "அமைப்புகள் சேமிக்கப்பட்டன. (Settings saved successfully.)",
                icon: "success",
                confirmButtonColor: "#4f46e5",
                confirmButtonText: "சரி (OK)"
            });
        } catch (err) {
            console.error("Failed to save settings:", err);
            Swal.fire("Error", "சேமிப்பதில் தோல்வி (Failed to save settings)", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
                <p className="text-gray-500 font-bold text-sm">அமைப்புகள் ஏற்றப்படுகின்றன... (Loading Settings...)</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-xl shadow-indigo-50/20 overflow-hidden transition-all duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 p-8 text-white relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg">
                        <Settings size={24} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight font-sans">பொதுவான அமைப்புகள் (App Settings)</h2>
                        <p className="text-indigo-200 text-xs font-bold mt-1 uppercase tracking-widest">System Configurations</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-8 space-y-8">
                {/* Gemini API Key */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-wider">
                        <Key size={16} className="text-indigo-600" />
                        ஜெமினி ஏபிஐ கீ (Gemini API Key)
                    </label>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                        தமிழ் எழுத்துப் பிழை திருத்தத்திற்கு (AI Spell Check) தேவையான ஜெமினி ஏபிஐ கீ-யை இங்கு உள்ளிடவும். இது தரவுத்தளத்தில் பாதுகாப்பாக சேமிக்கப்படும்.
                        (Enter the Gemini API Key required for AI Tamil Spell Check. This is stored securely in the database.)
                    </p>
                    <div className="relative flex items-center">
                        <input
                            type={showKey ? "text" : "password"}
                            value={settings.geminiApiKey}
                            onChange={e => setSettings({ ...settings, geminiApiKey: e.target.value })}
                            placeholder="AIzaSy..."
                            className="w-full pl-4 pr-12 py-3.5 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-mono text-sm font-bold text-slate-800 bg-slate-50/50 focus:bg-white"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-4 text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <div className="h-px bg-gray-100"></div>

                {/* Academic Year */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-wider">
                        <Calendar size={16} className="text-indigo-600" />
                        கல்வியாண்டு (Academic Year)
                    </label>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                        வினாத்தாள்களுக்குப் பயன்படுத்தப்படும் இயல்புநிலை கல்வியாண்டை உள்ளிடவும்.
                        (Enter the default academic year to be used for newly created question papers.)
                    </p>
                    <input
                        type="text"
                        value={settings.academicYear}
                        onChange={e => setSettings({ ...settings, academicYear: e.target.value })}
                        placeholder="e.g. 2026-27"
                        className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-sans text-sm font-bold text-slate-800 bg-slate-50/50 focus:bg-white"
                    />
                </div>

                {/* Info Box */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-4 shadow-inner">
                    <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700">
                        <Sparkles size={18} className="animate-pulse" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">குறிப்பு (Important Note)</h4>
                        <p className="text-xs text-indigo-700/80 font-bold mt-1 leading-relaxed">
                            இங்கு சேமிக்கப்படும் அமைப்புகள் உடனடியாகப் பயன்பாட்டுக்கு வரும். கல்வியாண்டை மாற்றினால் புதிய வினாத்தாள்கள் அந்த ஆண்டைக் கொண்டே உருவாக்கப்படும்.
                            (Saved settings apply immediately. Changing the academic year will apply to all newly created blueprints.)
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
                        {isSaving ? "சேமிக்கப்படுகிறது... (Saving...)" : "அமைப்புகளைச் சேமி (Save Settings)"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AdminAppSettingsManager;
