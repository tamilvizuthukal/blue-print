import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { ExtendedClassLevel, CognitiveLevel, DifficultyLevel, PaperType, QuestionType, ItemFormat } from '../types';
import { ITEM_FORMATS, COGNITIVE_PROCESSES, KNOWLEDGE_LEVELS } from '../constants';

interface SettingsManagerProps {
  view: 'paper-types' | 'class-subject' | 'unit-subunit' | 'taxonomy';
  classes: ExtendedClassLevel[];
  levels: CognitiveLevel[];
  difficultyLevels: DifficultyLevel[];
  paperTypes: PaperType[];
  updateClasses: (c: ExtendedClassLevel[]) => void;
  updateLevels: (l: CognitiveLevel[]) => void;
  updateDifficulty: (d: DifficultyLevel[]) => void;
  updatePaperTypes: (pt: PaperType[]) => void;
}

const SettingsManager: React.FC<SettingsManagerProps> = ({
  view,
  classes, levels, difficultyLevels, paperTypes,
  updateClasses, updateLevels, updateDifficulty, updatePaperTypes
}) => {

  const [newClassName, setNewClassName] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  const [newUnitName, setNewUnitName] = useState('');
  const [newSubUnitName, setNewSubUnitName] = useState('');
  const [newObjective, setNewObjective] = useState('');

  const [newPaperTypeName, setNewPaperTypeName] = useState('');
  const [newMarkValue, setNewMarkValue] = useState(1);
  const [newMaxQuestions, setNewMaxQuestions] = useState(1);

  // --- CRUD ACTIONS ---

  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    updateClasses([...classes, { id: `c_${Date.now()}`, name: newClassName.trim(), subjects: [] }]);
    setNewClassName('');
    Swal.fire("Added", "Grade added successfully", "success");
  };

  const handleDeleteClass = (id: string) => {
    Swal.fire({
        title: "Are you sure?",
        text: "Delete this grade? All associated data will be lost.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
    }).then(result => {
        if (result.isConfirmed) {
            updateClasses(classes.filter(c => c.id !== id));
            Swal.fire("Deleted", "Grade has been removed", "success");
        }
    });
  };

  const handleAddSubject = () => {
    if (!newSubjectName.trim() || !selectedClassId) return;
    const currentClass = classes.find(c => c.id === selectedClassId);
    if (!currentClass) return;

    updateClasses(classes.map(c => c.id === selectedClassId ? {
      ...c, subjects: [...c.subjects, { 
        id: `s_${Date.now()}`, 
        name: newSubjectName.trim(), 
        units: [],
        classLevel: currentClass.id as any,
        subject: newSubjectName.trim() as any
      }]
    } : c));
    setNewSubjectName('');
    Swal.fire("Added", "Subject added successfully", "success");
  };

  const handleDeleteSubject = (sId: string) => {
    Swal.fire({
        title: "Delete this subject?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        confirmButtonText: "Delete"
    }).then(result => {
        if (result.isConfirmed) {
            updateClasses(classes.map(c => c.id === selectedClassId ? {
              ...c, subjects: c.subjects.filter(s => s.id !== sId)
            } : c));
            Swal.fire("Deleted", "Subject has been removed", "success");
        }
    });
  };

  const handleAddUnit = () => {
    if (!newUnitName.trim() || !selectedClassId || !selectedSubjectId) return;
    updateClasses(classes.map(c => c.id === selectedClassId ? {
      ...c, subjects: c.subjects.map(s => s.id === selectedSubjectId ? {
        ...s, units: [...s.units, { 
          id: `u_${Date.now()}`, 
          name: newUnitName.trim(), 
          subUnits: [], 
          unitNumber: s.units.length + 1,
          learningOutcomes: ''
        }]
      } : s)
    } : c));
    setNewUnitName('');
    Swal.fire("Added", "Unit added successfully", "success");
  };

  const handleDeleteUnit = (uId: string) => {
    Swal.fire({
        title: "Delete this unit?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        confirmButtonText: "Delete"
    }).then(result => {
        if (result.isConfirmed) {
            updateClasses(classes.map(c => c.id === selectedClassId ? {
              ...c, subjects: c.subjects.map(s => s.id === selectedSubjectId ? {
                ...s, units: s.units.filter(u => u.id !== uId)
              } : s)
            } : c));
            Swal.fire("Deleted", "Unit has been removed", "success");
        }
    });
  };

  const handleAddSubUnit = (unitId: string) => {
    if (!newSubUnitName.trim()) return;
    updateClasses(classes.map(c => c.id === selectedClassId ? {
      ...c, subjects: c.subjects.map(s => s.id === selectedSubjectId ? {
        ...s, units: s.units.map(u => u.id === unitId ? {
          ...u, subUnits: [...u.subUnits, { 
            id: `sub_${Date.now()}`, 
            name: newSubUnitName.trim(), 
            learningObjective: newObjective || 'General Learning Objective' 
          }]
        } : u)
      } : s)
    } : c));
    setNewSubUnitName('');
    setNewObjective('');
    Swal.fire("Added", "Topic added successfully", "success");
  };

  const handleDeleteSubUnit = (unitId: string, subId: string) => {
    updateClasses(classes.map(c => c.id === selectedClassId ? {
      ...c, subjects: c.subjects.map(s => s.id === selectedSubjectId ? {
        ...s, units: s.units.map(u => u.id === unitId ? {
          ...u, subUnits: u.subUnits.filter(sub => sub.id !== subId)
        } : u)
      } : s)
    } : c));
  };

  const handleAddPaperType = () => {
    if (!newPaperTypeName.trim()) return;
    updatePaperTypes([...paperTypes, { 
      id: `pt_${Date.now()}`, 
      name: newPaperTypeName, 
      sections: [],
      totalMarks: 0,
      description: ''
    }]);
    setNewPaperTypeName('');
    Swal.fire("Created", "Pattern created successfully", "success");
  };

  const handleDeletePaperType = (id: string) => {
    Swal.fire({
        title: "Delete this template?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        confirmButtonText: "Delete"
    }).then(result => {
        if (result.isConfirmed) {
            updatePaperTypes(paperTypes.filter(p => p.id !== id));
            Swal.fire("Deleted", "Template removed", "success");
        }
    });
  };

  const handleAddQuestionType = (ptId: string) => {
    updatePaperTypes(paperTypes.map(pt => pt.id === ptId ? {
      ...pt,
      sections: [...pt.sections, { 
        id: `qt_${Date.now()}`, 
        marks: newMarkValue, 
        count: newMaxQuestions,
        maxQuestions: newMaxQuestions 
      }]
    } : pt));
  };

  const handleDeleteQuestionType = (ptId: string, qtId: string) => {
    updatePaperTypes(paperTypes.map(pt => pt.id === ptId ? {
      ...pt,
      sections: pt.sections.filter(q => q.id !== qtId)
    } : pt));
  };

  return (
    <div className="space-y-12 animate-in max-w-6xl mx-auto pb-24">

      {view === 'class-subject' && (
        <div className="bg-white p-8 md:p-14 rounded-[4rem] border border-slate-200 shadow-2xl">
          <h2 className="text-4xl font-black mb-12 text-slate-900 border-l-8 border-indigo-600 pl-8 uppercase tracking-widest">Grades & Curriculum</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="space-y-8">
              <label className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] px-2">Academic Grade Registry</label>
              <div className="flex gap-2 bg-slate-50 p-3 rounded-3xl border-2 border-slate-50">
                <input className="flex-1 px-6 py-4 rounded-2xl bg-white font-black text-lg outline-none shadow-sm focus:ring-4 focus:ring-indigo-100" placeholder="e.g. Class IX" value={newClassName} onChange={e => setNewClassName(e.target.value)} />
                <button onClick={handleAddClass} className="bg-indigo-600 text-white px-8 rounded-2xl font-black shadow-xl">Add</button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {classes.map(c => (
                  <div key={c.id} onClick={() => setSelectedClassId(c.id)} className={`p-6 rounded-3xl border-2 flex justify-between items-center cursor-pointer transition-all ${selectedClassId === c.id ? 'border-indigo-600 bg-indigo-50 shadow-xl shadow-indigo-600/10' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                    <span className="font-black text-slate-800 text-xl">{c.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black uppercase text-slate-400">{c.subjects.length} Subjects</span>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteClass(c.id); }} className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all font-black text-lg">&times;</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-8">
              <label className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.3em] px-2">Departmental Subjects</label>
              <div className="flex gap-2 bg-slate-50 p-3 rounded-3xl border-2 border-slate-50">
                <input className="flex-1 px-6 py-4 rounded-2xl bg-white font-black text-lg outline-none shadow-sm focus:ring-4 focus:ring-emerald-100 disabled:opacity-30" placeholder="e.g. Tamil AT" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} disabled={!selectedClassId} />
                <button onClick={handleAddSubject} className="bg-emerald-600 text-white px-8 rounded-2xl font-black disabled:opacity-30 shadow-xl shadow-emerald-600/10">Add</button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {classes.find(c => c.id === selectedClassId)?.subjects.map(s => (
                  <div key={s.id} className="p-6 rounded-3xl border-2 border-slate-50 bg-white flex justify-between items-center shadow-sm hover:border-emerald-500 transition-all">
                    <span className="font-black text-slate-700 uppercase tracking-tight text-lg">{s.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{s.units.length} Units</span>
                      <button onClick={() => handleDeleteSubject(s.id)} className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all font-black">&times;</button>
                    </div>
                  </div>
                ))}
                {!selectedClassId && <div className="text-center py-20 text-slate-200 font-black uppercase text-2xl border-4 border-dashed rounded-[3rem]">Select Grade First</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'unit-subunit' && (
        <div className="bg-white p-8 md:p-14 rounded-[4rem] border border-slate-200 shadow-2xl space-y-12">
          <h2 className="text-4xl font-black text-slate-900 border-l-8 border-indigo-600 pl-8 uppercase tracking-widest leading-none">Content Repository</h2>
          <div className="flex flex-col md:flex-row gap-6 bg-slate-50 p-4 rounded-[3rem] border border-slate-200 no-print">
            <select className="flex-1 p-5 rounded-[2rem] bg-white font-black text-lg outline-none border border-slate-200 shadow-sm appearance-none cursor-pointer" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
              <option value="">Select Grade</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="flex-1 p-5 rounded-[2rem] bg-white font-black text-lg outline-none border border-slate-200 shadow-sm appearance-none cursor-pointer" value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)} disabled={!selectedClassId}>
              <option value="">Select Subject</option>
              {classes.find(c => c.id === selectedClassId)?.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {selectedSubjectId ? (
            <div className="space-y-16">
              <div className="bg-indigo-50 p-10 rounded-[4rem] border border-indigo-100">
                <h4 className="font-black text-indigo-600 uppercase text-xs mb-8 tracking-[0.3em] px-2">Create New Curricular Unit</h4>
                <div className="flex gap-4">
                  <input className="flex-1 p-6 rounded-[2.5rem] bg-white font-black text-2xl outline-none shadow-xl shadow-indigo-600/5 focus:ring-8 focus:ring-indigo-100 border border-indigo-100" placeholder="Unit Name..." value={newUnitName} onChange={e => setNewUnitName(e.target.value)} />
                  <button onClick={handleAddUnit} className="bg-indigo-600 text-white px-12 rounded-[2.5rem] font-black shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all">Commit Unit</button>
                </div>
              </div>

              <div className="space-y-12">
                {classes.find(c => c.id === selectedClassId)?.subjects.find(s => s.id === selectedSubjectId)?.units.map(u => (
                  <div key={u.id} className="p-10 border-2 border-slate-100 rounded-[4rem] shadow-sm space-y-10 bg-white hover:border-indigo-100 transition-all relative group/unit">
                    <button onClick={() => handleDeleteUnit(u.id)} className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all font-black text-xl shadow-sm opacity-0 group-hover/unit:opacity-100">&times;</button>

                    <div className="flex flex-col border-b border-slate-50 pb-8">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2">Curriculum Component</span>
                      <h4 className="font-black text-4xl text-slate-900 uppercase tracking-tight">{u.name}</h4>
                    </div>

                    <div className="space-y-10">
                      <div className="bg-slate-50 p-8 rounded-[3rem] space-y-6 border border-slate-100">
                        <div className="flex gap-4">
                          <input className="flex-1 p-5 rounded-3xl bg-white font-black text-xl outline-none border border-slate-100 shadow-sm" placeholder="Discourse / Sub-topic Label..." value={newSubUnitName} onChange={e => setNewSubUnitName(e.target.value)} />
                          <button onClick={() => handleAddSubUnit(u.id)} className="bg-slate-900 text-white px-10 rounded-3xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Add Topic</button>
                        </div>
                        <textarea className="w-full p-6 text-sm font-medium rounded-3xl bg-white outline-none border border-slate-100 shadow-sm custom-scrollbar" placeholder="Enter Learning Objective / Taxonomy Details..." rows={2} value={newObjective} onChange={e => setNewObjective(e.target.value)} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {u.subUnits.map(sub => (
                          <div key={sub.id} className="p-8 rounded-[3rem] border-2 border-slate-50 bg-slate-50/50 flex flex-col justify-between hover:bg-white hover:border-indigo-600/20 hover:shadow-2xl transition-all group/sub relative">
                            <button onClick={() => handleDeleteSubUnit(u.id, sub.id)} className="absolute top-4 right-4 text-slate-200 hover:text-rose-500 opacity-0 group-hover/sub:opacity-100 transition-all font-black text-xl">&times;</button>
                            <div className="font-black text-indigo-700 text-xl mb-4 tracking-tight">{sub.name}</div>
                            <div className="text-[11px] font-medium text-slate-400 italic leading-relaxed uppercase tracking-wider">{sub.learningObjective}</div>
                          </div>
                        ))}
                        {u.subUnits.length === 0 && <div className="col-span-2 text-center py-10 text-slate-300 font-black uppercase text-xs tracking-widest italic">No Topics Registered</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-40 text-center border-4 border-dashed border-slate-100 rounded-[5rem] text-slate-200 font-black uppercase text-3xl tracking-widest">
              Hierarchy Navigation Required
            </div>
          )}
        </div>
      )}

      {view === 'paper-types' && (
        <div className="bg-white p-8 md:p-14 rounded-[4rem] border border-slate-200 shadow-2xl space-y-16">
          <h2 className="text-4xl font-black text-slate-900 border-l-8 border-indigo-600 pl-8 uppercase tracking-widest leading-none">Standardized Patterns</h2>
          <div className="flex gap-4 p-5 bg-slate-50 rounded-[3rem] border border-slate-100 no-print">
            <input className="flex-1 px-8 py-5 rounded-[2.5rem] bg-white font-black text-2xl outline-none shadow-xl shadow-indigo-600/5 focus:ring-8 focus:ring-indigo-100 border border-indigo-100" placeholder="Pattern Name (e.g. Quarterly)" value={newPaperTypeName} onChange={e => setNewPaperTypeName(e.target.value)} />
            <button onClick={handleAddPaperType} className="bg-indigo-600 text-white px-12 rounded-[2.5rem] font-black shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all">Create Pattern</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {paperTypes.map(pt => (
              <div key={pt.id} className="p-10 rounded-[4rem] border-2 border-slate-50 bg-white shadow-sm space-y-8 relative group hover:shadow-2xl hover:border-indigo-600/20 transition-all">
                <button onClick={() => handleDeletePaperType(pt.id)} className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all font-black text-xl shadow-sm opacity-0 group-hover:opacity-100">&times;</button>

                <div className="flex flex-col border-b border-slate-50 pb-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Assessment Template</span>
                  <h4 className="font-black text-3xl text-slate-800 uppercase tracking-tight">{pt.name}</h4>
                </div>

                <div className="bg-slate-50 p-6 rounded-[2.5rem] space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 px-4 tracking-widest">Weightage (Marks)</label>
                      <input type="number" className="w-full p-4 rounded-2xl bg-white border border-slate-100 font-black text-xl text-center shadow-sm" value={isNaN(newMarkValue) ? '' : newMarkValue} onChange={e => setNewMarkValue(Number(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 px-4 tracking-widest">Slot Count (Items)</label>
                      <input type="number" className="w-full p-4 rounded-2xl bg-white border border-slate-100 font-black text-xl text-center shadow-sm" value={isNaN(newMaxQuestions) ? '' : newMaxQuestions} onChange={e => setNewMaxQuestions(Number(e.target.value) || 0)} />
                    </div>
                  </div>                  <button onClick={() => handleAddQuestionType(pt.id)} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-900/10">Register Marks Category</button>
                </div>

                <div className="space-y-3">
                  {pt.sections.map(qt => (
                    <div key={qt.id} className="flex justify-between items-center p-5 bg-indigo-50/50 rounded-3xl border border-indigo-50 group/item transition-all hover:bg-indigo-100">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Allocation</span>
                        <span className="font-black text-sm text-indigo-900">{qt.maxQuestions} Items &times; {qt.marks} Marks</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-2xl font-black text-xs shadow-md">{qt.marks * qt.maxQuestions} M</span>
                        <button onClick={() => handleDeleteQuestionType(pt.id, qt.id)} className="text-slate-300 hover:text-rose-500 font-black text-xl transition-colors">&times;</button>
                      </div>
                    </div>
                  ))}
                  {pt.sections.length === 0 && <div className="text-center py-6 text-slate-300 font-black uppercase text-[10px] tracking-widest italic">No Categories Defined</div>}
                </div>
              </div>
            ))}
            {paperTypes.length === 0 && <div className="col-span-2 py-40 text-center border-4 border-dashed border-slate-100 rounded-[5rem] text-slate-200 font-black uppercase text-3xl tracking-widest">No Patterns Registered</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsManager;
