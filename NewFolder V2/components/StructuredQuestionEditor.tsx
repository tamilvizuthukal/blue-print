import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { BlueprintItem, MatchPairItem, ProfileRow, WordSunNode, StructuredQuestionContent } from '../types';

const makeId = () => globalThis.crypto?.randomUUID?.() || `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function StructuredQuestionPreview({ item }: { item: BlueprintItem }) {
  const content = item.questionContent;
  if (!content || content.type === 'text') return null;
  if (content.type === 'match_pairs' && content.matchPairs) {
    const data = content.matchPairs;
    return <>{data.prompt && <div className="sq-structured-prompt"><span>{data.prompt}</span></div>}<div className="sq-match" aria-label="பொருத்துக வினா">
        {[{ items: data.leftItems }, { items: data.rightItems }].map((column, ci) =>
        <section key={ci}>{column.items.map((row, index) => <div className="sq-match-row" key={row.id}><b>{ci === 0 ? `${index + 1}.` : `${letterLabel(index)})`}</b><span>{row.text || '\u00a0'}</span></div>)}</section>)}</div></>;
  }
  if (content.type === 'profile_table' && content.profileTable) return <>
    {content.profileTable.prompt && <div className="sq-structured-prompt"><span>{content.profileTable.prompt}</span></div>}
    <div className={`sq-profile ${content.profileTable.bordered ? 'bordered' : ''}`}>
      {content.profileTable.rows.map(row => <div className="sq-profile-row" key={row.id}><b>{row.label}</b><span>{row.value}</span></div>)}
    </div>
  </>;
  if (content.type === 'multiple_choice' && content.multipleChoice) return <>
    {content.multipleChoice.prompt && <div className="sq-structured-prompt"><span>{content.multipleChoice.prompt}</span></div>}
    <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{content.multipleChoice.options.map((option, i) => <div className="flex gap-2" key={option.id}><b>{letterLabel(i)})</b><span>{option.text}</span></div>)}</div>
  </>;
  if (content.type === 'word_sun' && content.wordSun) {
    const { centerText, nodes } = content.wordSun;
    const graphemes = (text: string) => { const Segmenter=(Intl as any).Segmenter; return Segmenter ? [...new Segmenter('ta',{granularity:'grapheme'}).segment(text)].map((part:any)=>part.segment) : Array.from(text); };
    const wrap = (text: string, limit: number) => {
      const result: string[] = []; let current = '';
      const splitLongWord = (word: string) => { const chars = graphemes(word); while (chars.length > limit) result.push(chars.splice(0, limit).join('')); return chars.join(''); };
      for (const word of String(text || '').trim().split(/\s+/).filter(Boolean)) {
        const remainder = splitLongWord(word); if (!remainder) continue;
        const next = current ? `${current} ${remainder}` : remainder;
        if (current && graphemes(next).length > limit) { result.push(current); current = remainder; } else current = next;
      }
      if (current) result.push(current);
      return result.length ? result : [''];
    };
    const measure = (text: string) => { const line = wrap(text, 11); return { lines: line, w: Math.min(200, Math.max(128, Math.max(...line.map(v => graphemes(v).length), 0) * 14 + 28)), h: Math.max(42, line.length * 20 + 14) }; };
    const center = measure(centerText);
    center.w = Math.min(250, Math.max(220, center.w));
    const sizedNodes = nodes.map(node => ({ ...node, ...measure(node.text) }));
    const maxNodeWidth = Math.max(114, ...sizedNodes.map(node => node.w));
    const maxNodeHeight = Math.max(40, ...sizedNodes.map(node => node.h));
    const radius = nodes.length ? Math.max(115, nodes.length * 32, (center.w + maxNodeWidth) / 2 + 18, (center.h + maxNodeHeight) / 2 + 18) : 0;
    const radiusX = nodes.length ? Math.max(radius * 1.28, (center.w + maxNodeWidth) / 2 + 24) : 0;
    const radiusY = nodes.length ? Math.max((center.h + maxNodeHeight) / 2 + 16, radius * 0.72) : 0;
    const width = nodes.length ? Math.max(360, radiusX * 2 + maxNodeWidth + 30) : Math.max(300, center.w + 40);
    const height = nodes.length ? Math.max(220, radiusY * 2 + maxNodeHeight + 24) : Math.max(120, center.h + 40);
    const cx = width / 2, cy = height / 2;
    const positioned = sizedNodes.map((node, i) => { const angle = -Math.PI / 2 + (2 * Math.PI * i) / nodes.length; return { ...node, x: cx + Math.cos(angle) * radiusX, y: cy + Math.sin(angle) * radiusY }; });
    const edge = (x: number, y: number, w: number, h: number, dx: number, dy: number) => { const scale=1/Math.max(Math.abs(dx)/(w/2),Math.abs(dy)/(h/2),0.001); return {x:x+dx*scale,y:y+dy*scale}; };
    return <>{content.wordSun.prompt && <div className="sq-structured-prompt"><span>{content.wordSun.prompt}</span></div>}<svg className="sq-word-sun" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="சொற்சூரியன் வினா">
      {positioned.map(node => {const start=edge(cx,cy,center.w,center.h,node.x-cx,node.y-cy);const end=edge(node.x,node.y,node.w,node.h,cx-node.x,cy-node.y);return <line key={`l-${node.id}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="currentColor" strokeWidth="1.5"/>;})}
      {positioned.map(node => <g key={node.id}><rect x={node.x-node.w/2} y={node.y-node.h/2} width={node.w} height={node.h} rx="4" fill="white" stroke="currentColor"/><text x={node.x} y={node.y-(node.lines.length-1)*9} textAnchor="middle" dominantBaseline="middle">{node.lines.map((line,i)=><tspan key={i} x={node.x} dy={i===0?0:18}>{line}</tspan>)}</text></g>)}
      <g><rect x={cx-center.w/2} y={cy-center.h/2} width={center.w} height={center.h} rx="6" fill="white" stroke="currentColor" strokeWidth="2"/><text x={cx} y={cy-(center.lines.length-1)*9} textAnchor="middle" dominantBaseline="middle">{center.lines.map((line,i)=><tspan key={i} x={cx} dy={i===0?0:18}>{line}</tspan>)}</text></g>
    </svg></>;
  }
  return null;
}

const letterLabels = ['அ','ஆ','இ','ஈ','உ','ஊ','எ','ஏ','ஐ','ஒ','ஓ','ஔ'];
const letterLabel = (i: number) => letterLabels[i] || String(i + 1);

export default function StructuredQuestionEditor({ item, contentValue, onChange, onTypeChange }: { item: BlueprintItem; contentValue?: StructuredQuestionContent; onChange: (content: StructuredQuestionContent) => void; onTypeChange?: (type: StructuredQuestionContent['type']) => void }) {
  const content = contentValue || item.questionContent || { type: 'text' as const };
  const [selectedType, setSelectedType] = useState<StructuredQuestionContent['type']>(content.type);
  const [mcqDraft, setMcqDraft] = useState<{ prompt: string; options: {id:string;text:string}[]; correctOptionId: string }>(() => content.multipleChoice || { prompt: '', options: Array.from({length:4},()=>({id:makeId(),text:''})), correctOptionId: '' });
  useEffect(() => { setSelectedType(content.type); if (content.multipleChoice) setMcqDraft(content.multipleChoice); }, [content.type, content.multipleChoice]);
  const type = selectedType;
  const updateMatch = (patch: Partial<NonNullable<StructuredQuestionContent['matchPairs']>>) => onChange({ ...content, type, matchPairs: { prompt: '', leftTitle: '', rightTitle: '', leftItems: [], rightItems: [], answerMappings: [], ...content.matchPairs, ...patch } });
  const updateProfile = (patch: Partial<NonNullable<StructuredQuestionContent['profileTable']>>) => onChange({ ...content, type, profileTable: { prompt: '', rows: [], bordered: true, ...content.profileTable, ...patch } });
  const updateSun = (patch: Partial<NonNullable<StructuredQuestionContent['wordSun']>>) => onChange({ ...content, type, wordSun: { prompt: '', centerText: '', nodes: [], ...content.wordSun, ...patch } });
  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500';
  const button = 'inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50';
  return <div className="space-y-4">
    <label className="block text-xs font-bold text-slate-600">வினா வடிவம்
      <select className={`${inputClass} mt-1`} value={type} onChange={e => { const next=e.target.value as StructuredQuestionContent['type']; setSelectedType(next); onTypeChange?.(next); if(next==='multiple_choice') setMcqDraft(content.multipleChoice || {prompt:'',options:Array.from({length:4},()=>({id:makeId(),text:''})),correctOptionId:''}); else onChange({ type: next }); }}>
        <option value="text">சாதாரண உரை வினா</option><option value="match_pairs">ஏற்றபடி இணைத்து எழுதுக</option><option value="profile_table">தன்விவரப் பட்டியல்</option><option value="word_sun">சொற்சூரியனைப் பூர்த்தி செய்க.</option><option value="multiple_choice">பல்தேர்வு வினா</option>
      </select>
    </label>
    {type === 'text' && <p className="text-xs text-slate-500">கீழே உள்ள உரை Editor-இல் வழக்கம்போல் வினாவை உள்ளிடவும்.</p>}
    {type === 'multiple_choice' && <section className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <label className="block text-xs font-bold text-slate-600">வினா<textarea className={inputClass} rows={2} placeholder="வினாவை உள்ளிடவும்" value={mcqDraft.prompt} onChange={e=>setMcqDraft({...mcqDraft,prompt:e.target.value})}/></label>
      <div className="space-y-2">{mcqDraft.options.map((option,i)=><div className="flex items-start gap-2" key={option.id}><b className="pt-2">{letterLabel(i)})</b><textarea className={inputClass} rows={2} placeholder={`ஆப்ஷன் ${i+1}`} value={option.text} onChange={e=>setMcqDraft({...mcqDraft,options:mcqDraft.options.map(o=>o.id===option.id?{...o,text:e.target.value}:o)})}/><button type="button" className="pt-2 text-red-600 disabled:opacity-30" aria-label="ஆப்ஷனை நீக்கு" disabled={mcqDraft.options.length<=2} onClick={()=>setMcqDraft({...mcqDraft,options:mcqDraft.options.filter(o=>o.id!==option.id),correctOptionId:mcqDraft.correctOptionId===option.id?'':mcqDraft.correctOptionId})}><Trash2 size={16}/></button></div>)}</div>
      <button type="button" className={button} onClick={()=>setMcqDraft({...mcqDraft,options:[...mcqDraft.options,{id:makeId(),text:''}]})}><Plus size={14}/> ஆப்ஷன் சேர்</button>
      <label className="block text-xs font-bold text-slate-600">சரியான விடை<select className={`${inputClass} mt-1`} value={mcqDraft.correctOptionId} onChange={e=>setMcqDraft({...mcqDraft,correctOptionId:e.target.value})}><option value="">சரியான ஆப்ஷனைத் தேர்ந்தெடுக்கவும்</option>{mcqDraft.options.map((o,i)=><option key={o.id} value={o.id}>{letterLabel(i)}) {o.text || `ஆப்ஷன் ${i+1}`}</option>)}</select></label>
      <button type="button" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={!mcqDraft.prompt.trim() || mcqDraft.options.length<2 || mcqDraft.options.some(o=>!o.text.trim()) || !mcqDraft.correctOptionId} onClick={()=>onChange({type:'multiple_choice',multipleChoice:mcqDraft})}>சரியான விடையைத் தேர்ந்தெடுத்து சேமி</button>
      {!mcqDraft.correctOptionId && <p className="text-xs text-amber-700">சரியான விடையைத் தேர்ந்தெடுத்த பிறகே வினாவைச் சேமிக்க முடியும்.</p>}
    </section>}
    {type === 'match_pairs' && (() => { const data = content.matchPairs || { prompt: '', leftTitle: '', rightTitle: '', leftItems: [{id: makeId(),text:''},{id:makeId(),text:''}], rightItems: [{id: makeId(),text:''},{id:makeId(),text:''}], answerMappings: [] }; return <><label className="block text-xs font-bold text-slate-600">வினா உரை<textarea className={inputClass} rows={2} placeholder="வினாவை உள்ளிடவும்" value={data.prompt || ''} onChange={e => updateMatch({prompt:e.target.value})}/></label>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{(['left','right'] as const).map(side => { const rows = side === 'left' ? data.leftItems : data.rightItems; return <section key={side} className="rounded-xl border border-slate-200 p-3">{rows.map((row,i) => <div className="mb-2 flex items-start gap-2" key={row.id}><b className="pt-2">{side==='left' ? `${i+1}.` : `${letterLabel(i)})`}</b><textarea className={inputClass} rows={2} value={row.text} onChange={e => { const next=rows.map(v=>v.id===row.id?{...v,text:e.target.value}:v); updateMatch(side==='left'?{leftItems:next}:{rightItems:next}); }}/><button className="pt-2 text-red-600" aria-label="வரிசை நீக்கு" onClick={()=>{const next=rows.filter(v=>v.id!==row.id); updateMatch(side==='left'?{leftItems:next}:{rightItems:next});}}><Trash2 size={16}/></button></div>)}<button className={button} onClick={()=>{const next=[...rows,{id:makeId(),text:''}];updateMatch(side==='left'?{leftItems:next}:{rightItems:next});}}><Plus size={14}/> வரிசை சேர்</button></section>; })}</div>
      <p className="text-xs text-slate-500">விடைப் பொருத்தம் (மாணவர் Preview-இல் மறைக்கப்படும்)</p>
      {data.leftItems.map((left,index) => <div className="grid grid-cols-2 items-center gap-2" key={left.id}><span className="truncate text-xs">{left.text || `வரிசை ${index+1}`}</span><select className={inputClass} aria-label="பதில் பொருத்தம்" value={data.answerMappings.find(m=>m.leftId===left.id)?.rightId||''} onChange={e=>updateMatch({answerMappings:[...data.answerMappings.filter(m=>m.leftId!==left.id),...(e.target.value?[{leftId:left.id,rightId:e.target.value}]:[])]})}><option value="">பொருத்தம் தேர்வு செய்யவும்</option>{data.rightItems.map((r,i)=><option key={r.id} value={r.id}>{letterLabel(i)}) {r.text}</option>)}</select></div>)}
    </>; })()}
    {type === 'profile_table' && (() => { const rows=content.profileTable?.rows||[]; return <div className="space-y-2"><label className="block text-xs font-bold text-slate-600">வினா உரை<textarea className={inputClass} rows={2} placeholder="வினாவை உள்ளிடவும்" value={content.profileTable?.prompt||''} onChange={e=>updateProfile({prompt:e.target.value})}/></label>{rows.map((row,i)=><div className="grid grid-cols-[0.75fr_1.75fr_auto] gap-2" key={row.id}><input className={inputClass} placeholder="விவரம்" value={row.label} onChange={e=>updateProfile({rows:rows.map(r=>r.id===row.id?{...r,label:e.target.value}:r)})}/><textarea className={inputClass} rows={2} placeholder="உள்ளடக்கம்" value={row.value} onChange={e=>updateProfile({rows:rows.map(r=>r.id===row.id?{...r,value:e.target.value}:r)})}/><div className="flex flex-col gap-1"><button className={button} disabled={!i} onClick={()=>{const n=[...rows];[n[i-1],n[i]]=[n[i],n[i-1]];updateProfile({rows:n})}}><ArrowUp size={13}/></button><button className={button} disabled={i===rows.length-1} onClick={()=>{const n=[...rows];[n[i+1],n[i]]=[n[i],n[i+1]];updateProfile({rows:n})}}><ArrowDown size={13}/></button><button className="text-red-600" onClick={()=>updateProfile({rows:rows.filter(r=>r.id!==row.id)})}><Trash2 size={15}/></button></div></div>)}<button className={button} onClick={()=>updateProfile({rows:[...rows,{id:makeId(),label:'',value:''}]})}><Plus size={14}/> வரிசை சேர்</button><label className="ml-3 text-xs"><input type="checkbox" checked={content.profileTable?.bordered!==false} onChange={e=>updateProfile({bordered:e.target.checked})}/> Border</label></div>; })()}
    {type === 'word_sun' && (() => { const data=content.wordSun||{prompt:'',centerText:'',nodes:[{id:makeId(),text:'',position:0},{id:makeId(),text:'',position:1}]}; const nodes=data.nodes; return <><label className="block text-xs font-bold text-slate-600">வினா உரை<textarea className={inputClass} rows={2} placeholder="வினாவை உள்ளிடவும்" value={data.prompt || ''} onChange={e=>updateSun({prompt:e.target.value})}/></label><input className={inputClass} placeholder="மைய வினா / சொல்" value={data.centerText} onChange={e=>updateSun({centerText:e.target.value})}/>{nodes.map((node,i)=><div className="flex items-center gap-2" key={node.id}><textarea className={inputClass} rows={2} value={node.text} placeholder={`சொல் ${i+1}`} onChange={e=>updateSun({nodes:nodes.map(n=>n.id===node.id?{...n,text:e.target.value}:n)})}/><button className={button} disabled={!i} onClick={()=>{const n=[...nodes];[n[i-1],n[i]]=[n[i],n[i-1]];updateSun({nodes:n.map((v,j)=>({...v,position:j}))})}}><ArrowUp size={14}/></button><button className={button} disabled={i===nodes.length-1} onClick={()=>{const n=[...nodes];[n[i+1],n[i]]=[n[i],n[i+1]];updateSun({nodes:n.map((v,j)=>({...v,position:j}))})}}><ArrowDown size={14}/></button><button className="text-red-600" onClick={()=>updateSun({nodes:nodes.filter(n=>n.id!==node.id)})}><Trash2 size={16}/></button></div>)}<button className={button} onClick={()=>updateSun({nodes:[...nodes,{id:makeId(),text:'',position:nodes.length}]})}><Plus size={14}/> சொல் சேர்</button></>; })()}
    {type !== 'text' && type !== 'multiple_choice' && <div className="rounded-lg border bg-white p-3"><StructuredQuestionPreview item={{...item,questionContent:content}}/></div>}
    {type === 'multiple_choice' && mcqDraft.correctOptionId && <div className="rounded-lg border bg-white p-3"><StructuredQuestionPreview item={{...item,questionContent:{type:'multiple_choice',multipleChoice:mcqDraft}}}/></div>}
  </div>;
}
