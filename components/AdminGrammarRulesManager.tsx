import React, { useState, useEffect } from 'react';
import { 
    ChevronLeft, Settings, ToggleLeft, ToggleRight, CheckCircle, 
    AlertCircle, Layers, BookOpen, Edit, FileText, Check, HelpCircle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { GrammarRule } from '../types';
import { 
    getGrammarRules, toggleGlobalGrammar, toggleCategoryGrammar, toggleRuleGrammar 
} from '../services/db';

interface AdminGrammarRulesManagerProps {
    onBack: () => void;
}

const CATEGORIES = [
    { code: 'sandhi', name: 'சந்திப்பிழை (Sandhi Rules)', icon: '✍️' },
    { code: 'singular_plural', name: 'ஒருமை / பன்மை', icon: '👥' },
    { code: 'class', name: 'திணை', icon: '🏺' },
    { code: 'gender', name: 'பால்வகை', icon: '👤' },
    { code: 'tense', name: 'காலவகை', icon: '📅' },
    { code: 'case_suffixes', name: 'வேற்றுமை உருபுகள்', icon: '🏷️' },
    { code: 'finite_verb', name: 'வினைமுற்று', icon: '🎬' },
    { code: 'particle', name: 'இடைச்சொற்கள்', icon: '🔗' },
    { code: 'general', name: 'பொதுவான இலக்கணப் பிழைகள்', icon: '⚠️' }
];

export const AdminGrammarRulesManager: React.FC<AdminGrammarRulesManagerProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [globalEnabled, setGlobalEnabled] = useState(true);
    const [categoryStates, setCategoryStates] = useState<{ [key: string]: boolean }>({});
    const [rules, setRules] = useState<GrammarRule[]>([]);
    const [activeCategory, setActiveCategory] = useState('sandhi');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            // Force refresh from server when opening settings
            const data = await getGrammarRules(true);
            setGlobalEnabled(data.globalEnabled);
            setCategoryStates(data.categoryStates || {});
            setRules(data.rules || []);
        } catch (err) {
            console.error("Failed to load grammar rules settings:", err);
            Swal.fire("Error", "Failed to load grammar rule configurations.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleGlobalToggle = async () => {
        const nextState = !globalEnabled;
        setGlobalEnabled(nextState); // Optimistic update
        try {
            const res = await toggleGlobalGrammar(nextState);
            setGlobalEnabled(res.globalEnabled);
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500,
                timerProgressBar: true
            });
            Toast.fire({
                icon: 'success',
                title: nextState ? 'Grammar Checking Enabled Globally' : 'Grammar Checking Disabled Globally'
            });
        } catch (err) {
            setGlobalEnabled(!nextState); // Rollback
            console.error(err);
            Swal.fire("Error", "Failed to update global grammar checking setting.", "error");
        }
    };

    const handleCategoryToggle = async (categoryCode: string) => {
        const currentCategoryState = categoryStates[categoryCode] !== false;
        const nextState = !currentCategoryState;
        
        // Optimistic update
        setCategoryStates(prev => ({ ...prev, [categoryCode]: nextState }));
        
        try {
            const res = await toggleCategoryGrammar(categoryCode, nextState);
            setCategoryStates(res.categoryStates || {});
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500,
                timerProgressBar: true
            });
            Toast.fire({
                icon: 'success',
                title: nextState ? 'Category Enabled' : 'Category Disabled'
            });
        } catch (err) {
            // Rollback
            setCategoryStates(prev => ({ ...prev, [categoryCode]: currentCategoryState }));
            console.error(err);
            Swal.fire("Error", "Failed to update category setting.", "error");
        }
    };

    const handleRuleToggle = async (ruleId: string, currentEnabled: boolean) => {
        const nextState = !currentEnabled;
        
        // Optimistic update
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isEnabled: nextState } : r));

        try {
            const res = await toggleRuleGrammar(ruleId, nextState);
            setRules(prev => prev.map(r => r.id === ruleId ? res.rule : r));
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1000,
                timerProgressBar: true
            });
            Toast.fire({
                icon: 'success',
                title: nextState ? 'Rule Enabled' : 'Rule Disabled'
            });
        } catch (err) {
            // Rollback
            setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isEnabled: currentEnabled } : r));
            console.error(err);
            Swal.fire("Error", "Failed to update grammar rule setting.", "error");
        }
    };

    const filteredRules = rules.filter(r => r.category === activeCategory);
    const activeCategoryConfig = CATEGORIES.find(c => c.code === activeCategory);
    const isCurrentCategoryEnabled = categoryStates[activeCategory] !== false;

    // Helper to calculate total active rules under a category
    const getActiveRulesCount = (catCode: string) => {
        return rules.filter(r => r.category === catCode && r.isEnabled).length;
    };

    const getTotalRulesCount = (catCode: string) => {
        return rules.filter(r => r.category === catCode).length;
    };

    if (loading) {
        return (
            <div className="p-6 bg-slate-50/50 min-h-screen">
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={onBack} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 transition shadow-sm">
                        <ChevronLeft size={16} />
                    </button>
                    <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm h-[500px] animate-pulse" />
                    <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm h-[500px] animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-slate-50/50 min-h-screen text-slate-800">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack} 
                        className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-500 hover:text-slate-900 transition shadow-sm hover:shadow"
                        title="Back to Dictionary"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <Settings className="text-indigo-600 animate-spin-slow" size={22} />
                            Tamil Grammar Rules Management
                        </h1>
                        <p className="text-xs font-semibold text-slate-400 mt-1">
                            Enable or Disable Grammar Validation Rules used in Tamil Spell Checker and Grammar Engine.
                        </p>
                    </div>
                </div>

                {/* Global Toggle Card */}
                <div className={`flex items-center justify-between gap-6 px-6 py-4 rounded-2xl border transition-all shadow-sm ${
                    globalEnabled 
                    ? 'bg-indigo-50/50 border-indigo-100 text-indigo-900' 
                    : 'bg-slate-100/50 border-slate-200 text-slate-400'
                }`}>
                    <div className="flex items-center gap-3">
                        <BookOpen className={globalEnabled ? 'text-indigo-600' : 'text-slate-400'} size={20} />
                        <div>
                            <p className="text-sm font-black">Grammar checking</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                {globalEnabled ? 'Engine Active' : 'Spellcheck Only'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleGlobalToggle}
                        className="focus:outline-none transition hover:scale-105"
                    >
                        {globalEnabled ? (
                            <ToggleRight size={38} className="text-indigo-600" />
                        ) : (
                            <ToggleLeft size={38} className="text-slate-300" />
                        )}
                    </button>
                </div>
            </div>

            {/* Main grid */}
            <div className={`grid grid-cols-1 lg:grid-cols-4 gap-6 transition-all ${!globalEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                
                {/* Left side category panel */}
                <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm h-fit">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-3 mt-1">Categories</p>
                    <div className="flex flex-col gap-1.5">
                        {CATEGORIES.map(category => {
                            const isCatActive = activeCategory === category.code;
                            const isCatEnabled = categoryStates[category.code] !== false;
                            const activeRules = getActiveRulesCount(category.code);
                            const totalRules = getTotalRulesCount(category.code);

                            return (
                                <button
                                    key={category.code}
                                    onClick={() => setActiveCategory(category.code)}
                                    className={`w-full text-left px-3.5 py-3 rounded-xl font-bold text-xs flex items-center justify-between transition-all ${
                                        isCatActive 
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-lg">{category.icon}</span>
                                        <span className="truncate max-w-[130px]">{category.name}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full font-black text-[9px] ${
                                        isCatActive 
                                        ? 'bg-white/20 text-white' 
                                        : isCatEnabled 
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                            : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        {isCatEnabled ? `${activeRules}/${totalRules}` : 'OFF'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right side rules display panel */}
                <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    {activeCategoryConfig && (
                        <div>
                            {/* Category header & Toggle */}
                            <div className="flex items-center justify-between border-b border-slate-50 pb-5 mb-6">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{activeCategoryConfig.icon}</span>
                                    <div>
                                        <h2 className="text-base font-black text-slate-900">{activeCategoryConfig.name}</h2>
                                        <p className="text-xs font-semibold text-slate-400 mt-0.5">
                                            Manage specific validation rules within this category
                                        </p>
                                    </div>
                                </div>

                                <div className={`flex items-center gap-3 px-4 py-2 border rounded-xl shadow-xs transition ${
                                    isCurrentCategoryEnabled 
                                    ? 'bg-emerald-50/30 border-emerald-100 text-emerald-800' 
                                    : 'bg-slate-50 border-slate-200 text-slate-400'
                                }`}>
                                    <span className="text-xs font-bold">Category Status</span>
                                    <button 
                                        onClick={() => handleCategoryToggle(activeCategory)}
                                        className="focus:outline-none transition hover:scale-105"
                                    >
                                        {isCurrentCategoryEnabled ? (
                                            <ToggleRight size={30} className="text-emerald-600" />
                                        ) : (
                                            <ToggleLeft size={30} className="text-slate-300" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Rules list */}
                            <div className={`flex flex-col gap-4 transition-all ${!isCurrentCategoryEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                                {filteredRules.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400 font-semibold text-sm">
                                        No specific rules configured under this category.
                                    </div>
                                ) : (
                                    filteredRules.map(rule => (
                                        <div 
                                            key={rule.id}
                                            className={`p-5 rounded-2xl border transition-all flex items-start justify-between gap-6 ${
                                                rule.isEnabled 
                                                ? 'bg-white border-slate-100 shadow-sm hover:border-indigo-100' 
                                                : 'bg-slate-50/50 border-slate-100 text-slate-400'
                                            }`}
                                        >
                                            <div className="flex-1">
                                                <h4 className={`text-sm font-black flex items-center gap-2 ${rule.isEnabled ? 'text-slate-800' : 'text-slate-400'}`}>
                                                    <span className={`w-2 h-2 rounded-full ${rule.isEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                                                    {rule.ruleName}
                                                </h4>
                                                <p className={`text-xs font-semibold mt-1.5 leading-relaxed ${rule.isEnabled ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {rule.description || 'Description not configured for this rule.'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleRuleToggle(rule.id, rule.isEnabled)}
                                                className="focus:outline-none transition hover:scale-105 mt-1"
                                            >
                                                {rule.isEnabled ? (
                                                    <ToggleRight size={32} className="text-indigo-600" />
                                                ) : (
                                                    <ToggleLeft size={32} className="text-slate-300" />
                                                )}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Global Disabled Overlay Warning */}
            {!globalEnabled && (
                <div className="mt-8 bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                    <AlertCircle size={28} className="text-slate-400" />
                    <h3 className="text-sm font-black">Grammar Engine is Off</h3>
                    <p className="text-xs font-semibold max-w-md text-slate-400 leading-relaxed">
                        The entire grammar correction and suggestion engine is currently disabled. 
                        Only basic spell checking against dictionary terms is active. 
                        Turn it back ON in the header to manage individual categories and rules.
                    </p>
                </div>
            )}
        </div>
    );
};
