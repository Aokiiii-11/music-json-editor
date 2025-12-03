import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MusicData, GlobalDimension, SectionDimension } from '../types';

interface JsonEditorProps {
  data: MusicData;
  onChange: (newData: MusicData) => void;
}

// --- UTILITIES FOR SENTENCE SPLITTING ---

/**
 * Splits text into sentences/segments for highlighting.
 * Handles English (.!?) and Chinese (。！？) delimiters.
 * Safe against non-string inputs.
 */
const splitIntoSentences = (text: any): string[] => {
  if (typeof text !== 'string') return [String(text || '')];
  if (!text) return [];
  // Regex looks for punctuation followed by space or end of string, OR newline
  const segmenter = /[^.!?。！？\n]+[.!?。！？\n]*|[\n]+/g;
  const matches = text.match(segmenter);
  return matches ? Array.from(matches) : [text];
};

// --- SUB-COMPONENTS ---

/**
 * Renders a list of interactive sentences.
 * Supports Hover and Selection events.
 */
const InteractiveText: React.FC<{
  text: string;
  isSource: boolean;
  hoverIndex: number | null;
  onHover: (index: number | null) => void;
  // New props for selection sync
  highlightIndices: number[];
  onSelection: (indices: number[]) => void;
}> = ({ text, isSource, hoverIndex, onHover, highlightIndices, onSelection }) => {
  const safeText = typeof text === 'string' ? text : String(text || '');
  const sentences = useMemo(() => splitIntoSentences(safeText), [safeText]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle Text Selection
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection) return;

    // If selection is collapsed (just a cursor click), clear selection
    if (selection.isCollapsed) {
      onSelection([]);
      return;
    }

    // Check if the selection happened inside this container
    if (containerRef.current && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (containerRef.current.contains(range.commonAncestorContainer)) {
        const selectedIndices: number[] = [];
        const spans = containerRef.current.querySelectorAll('[data-index]');
        
        spans.forEach((span) => {
          if (selection.containsNode(span, true)) { // true = allow partial containment
             const idx = parseInt(span.getAttribute('data-index') || '-1');
             if (idx !== -1) selectedIndices.push(idx);
          }
        });

        if (selectedIndices.length > 0) {
           onSelection(selectedIndices);
        } else {
           onSelection([]);
        }
      }
    }
  };

  if (!safeText) return <span className="text-slate-300 italic">Empty</span>;

  return (
    <div 
      ref={containerRef}
      className={`whitespace-pre-wrap leading-relaxed ${isSource ? 'text-slate-700' : 'text-slate-800'}`}
      onMouseUp={handleMouseUp}
    >
      {sentences.map((sentence, idx) => {
        // Determine highlighting state
        const isSelectedByOther = highlightIndices.includes(idx);
        const isHovered = hoverIndex === idx && highlightIndices.length === 0; // Selection takes priority over hover

        let bgClass = '';
        if (isSelectedByOther) bgClass = 'bg-yellow-200'; // Stronger highlight for selection
        else if (isHovered) bgClass = 'bg-yellow-100'; // Softer highlight for hover

        return (
          <span
            key={idx}
            data-index={idx}
            className={`sentence-span ${bgClass} transition-colors duration-200 rounded-sm px-0.5`}
            onMouseEnter={() => onHover(idx)}
            onMouseLeave={() => onHover(null)}
          >
            {sentence}
          </span>
        );
      })}
    </div>
  );
};

interface TranslationUnitProps {
  label: string;
  value: any;
  onChange: (val: string) => void;
  multiline?: boolean;
  isImportant?: boolean;
  id?: string;
}

/**
 * The core component for editing a Bilingual pair.
 * Handles the "En | Cn" logic, View/Edit toggle, Hover sync, Selection sync, and Segmented Editing.
 */
const TranslationUnit: React.FC<TranslationUnitProps> = ({ label, value, onChange, multiline, isImportant, id }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [segmentMode, setSegmentMode] = useState(false); // Toggle for Segmented Editor
  
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [crossHighlightIndices, setCrossHighlightIndices] = useState<number[]>([]);

  // Parse Value safely
  const safeValue = (value === null || value === undefined) ? '' : String(value);
  const parts = safeValue.split('|');
  const en = parts[0]?.trim() || '';
  const cn = parts.length > 1 ? parts.slice(1).join('|').trim() : '';

  // Local state for editing mode
  const [editEn, setEditEn] = useState(en);
  const [editCn, setEditCn] = useState(cn);

  // Sync state with props when not editing
  useEffect(() => {
    if (!isEditing) {
      const currentSafeValue = (value === null || value === undefined) ? '' : String(value);
      const currentParts = currentSafeValue.split('|');
      setEditEn(currentParts[0]?.trim() || '');
      setEditCn(currentParts.length > 1 ? currentParts.slice(1).join('|').trim() : '');
    }
  }, [value, isEditing]);

  // Sync edits to parent
  const handleSave = () => {
    const cleanEn = editEn.trim();
    const cleanCn = editCn.trim();
    
    // Logic: If Source is deleted, remove entry.
    if (!cleanEn) {
       onChange('');
    } else {
       if (cleanCn) {
         onChange(`${cleanEn} | ${cleanCn}`);
       } else {
         onChange(cleanEn);
       }
    }
    setIsEditing(false);
    setSegmentMode(false);
  };

  // --- Segmented Mode Helpers ---
  const getSegments = (text: string) => splitIntoSentences(text);
  
  // When switching TO segment mode, we don't need to do anything special as we calculate segments on render
  // When switching FROM segment mode (or saving), we are just using the editEn/editCn strings which are updated live.

  const updateSegment = (idx: number, type: 'en'|'cn', newVal: string) => {
    const segmentsEn = getSegments(editEn);
    const segmentsCn = getSegments(editCn);
    
    if (type === 'en') {
      segmentsEn[idx] = newVal;
      setEditEn(segmentsEn.join(''));
    } else {
      segmentsCn[idx] = newVal;
      setEditCn(segmentsCn.join(''));
    }
  };

  const deleteSegmentPair = (idx: number) => {
    const segmentsEn = getSegments(editEn);
    const segmentsCn = getSegments(editCn);
    
    // Remove at index
    if (idx < segmentsEn.length) segmentsEn.splice(idx, 1);
    if (idx < segmentsCn.length) segmentsCn.splice(idx, 1);
    
    setEditEn(segmentsEn.join(''));
    setEditCn(segmentsCn.join(''));
  };

  // Selection Handlers
  const handleSourceSelection = (indices: number[]) => setCrossHighlightIndices(indices);
  const handleTargetSelection = (indices: number[]) => setCrossHighlightIndices(indices);

  const isMissingTranslation = en && !cn;
  
  // Prepare segments for rendering in Segment Mode
  const segmentsEn = useMemo(() => getSegments(editEn), [editEn]);
  const segmentsCn = useMemo(() => getSegments(editCn), [editCn]);
  const maxSegments = Math.max(segmentsEn.length, segmentsCn.length);
  const segmentRows = Array.from({ length: maxSegments }, (_, i) => i);

  return (
    <div 
      id={id}
      className={`group mb-4 rounded-xl border transition-all duration-200 ${
      isEditing 
        ? 'bg-white ring-2 ring-indigo-500 border-transparent shadow-lg z-10' 
        : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
    }`}>
      
      {/* Header Bar */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-slate-50 bg-slate-50/50 rounded-t-xl">
        <div className="flex items-center gap-2">
           <span className={`text-xs font-bold uppercase tracking-wider ${isImportant ? 'text-indigo-600' : 'text-slate-500'}`}>
             {label}
           </span>
           {!isEditing && isMissingTranslation && (
             <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
               <span className="material-icons text-[10px]">warning</span> Missing Translation
             </span>
           )}
        </div>
        
        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              onClick={() => setSegmentMode(!segmentMode)}
              className={`p-1 rounded hover:bg-slate-200 transition-colors ${segmentMode ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
              title={segmentMode ? "Switch to Text View" : "Switch to Segment View (Line-by-Line)"}
            >
              <span className="material-icons text-sm">{segmentMode ? 'article' : 'view_list'}</span>
            </button>
          )}
          <button 
            onClick={() => {
               if (isEditing) handleSave();
               else {
                   setIsEditing(true);
                   setSegmentMode(true); // Default to Segment Mode when opening
               }
            }}
            className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
              isEditing 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            {isEditing ? 'DONE' : 'EDIT'}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-0">
        {isEditing ? (
          // --- EDIT MODE ---
          <>
            {segmentMode ? (
               // SEGMENT MODE
               <div className="p-2 bg-slate-50/50 max-h-[400px] overflow-y-auto">
                 <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <div>Source Segment</div>
                    <div>Translation Segment</div>
                    <div></div>
                 </div>
                 {segmentRows.map((idx) => (
                   <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2 items-start group/row">
                      <textarea 
                        value={segmentsEn[idx] || ''}
                        onChange={(e) => updateSegment(idx, 'en', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                        rows={2}
                      />
                      <textarea 
                        value={segmentsCn[idx] || ''}
                        onChange={(e) => updateSegment(idx, 'cn', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                        rows={2}
                      />
                      <button 
                        onClick={() => deleteSegmentPair(idx)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors mt-1"
                        title="Delete this pair"
                      >
                         <span className="material-icons text-sm">delete</span>
                      </button>
                   </div>
                 ))}
                 {segmentRows.length === 0 && (
                   <div className="text-center py-4 text-slate-400 text-xs italic">No text segments found. Switch to Text View to add content.</div>
                 )}
               </div>
            ) : (
               // RAW TEXT MODE
               <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                  <div className="flex-1 p-2 bg-slate-50/30">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-[10px] text-slate-400 font-mono uppercase">English Source</div>
                      {!editEn && (
                        <div className="text-[9px] text-red-400 font-bold uppercase">Will delete entry</div>
                      )}
                    </div>
                    <textarea
                      className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-300 resize-none font-medium h-full min-h-[80px]"
                      value={editEn}
                      onChange={(e) => setEditEn(e.target.value)}
                      placeholder="English text..."
                      rows={multiline ? 6 : 2}
                      autoFocus
                    />
                  </div>
                  <div className="flex-1 p-2">
                    <div className="text-[10px] text-indigo-300 font-mono mb-1 uppercase">Chinese Translation</div>
                    <textarea
                      className={`w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-indigo-100 resize-none h-full min-h-[80px] transition-opacity ${!editEn ? 'opacity-30' : 'opacity-100'}`}
                      value={editCn}
                      onChange={(e) => setEditCn(e.target.value)}
                      placeholder="Translation..."
                      rows={multiline ? 6 : 2}
                      disabled={!editEn}
                    />
                  </div>
               </div>
            )}
          </>
        ) : (
          // --- VIEW MODE (With Interaction) ---
          <div 
             className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-100 min-h-[60px]"
             onDoubleClick={() => { setIsEditing(true); setSegmentMode(true); }}
          >
             {/* Left Column (Source) */}
             <div className="flex-1 p-4 bg-slate-50/20 group-hover:bg-slate-50/50 transition-colors">
                <InteractiveText 
                  text={en} 
                  isSource={true} 
                  hoverIndex={hoverIndex} 
                  onHover={setHoverIndex}
                  highlightIndices={crossHighlightIndices} 
                  onSelection={handleSourceSelection}
                />
             </div>

             {/* Right Column (Target) */}
             <div className="flex-1 p-4 group-hover:bg-indigo-50/5 transition-colors">
                {cn ? (
                  <InteractiveText 
                    text={cn} 
                    isSource={false} 
                    hoverIndex={hoverIndex} 
                    onHover={setHoverIndex}
                    highlightIndices={crossHighlightIndices} 
                    onSelection={handleTargetSelection}
                  />
                ) : (
                  <span className="text-slate-300 text-sm italic select-none">No translation provided...</span>
                )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- SECTION BLOCKS ---

const DictionaryBlock: React.FC<{
  data: Record<string, string>;
  onChange: (newData: Record<string, string>) => void;
  title: string;
  important?: boolean;
}> = ({ data, onChange, title, important }) => {
  if (!data) return null;

  return (
    <div className={`mb-6 ${important ? 'bg-indigo-50/50 border border-indigo-100 rounded-xl p-4' : ''}`}>
      <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${important ? 'text-indigo-700' : 'text-slate-400'}`}>
        {title}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(data).map(([key, value]) => (
          <TranslationUnit
            key={key}
            label={key}
            value={value}
            onChange={(val) => onChange({ ...data, [key]: val })}
            isImportant={important}
          />
        ))}
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const JsonEditor: React.FC<JsonEditorProps> = ({ data, onChange }) => {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const sections: SectionDimension[] = data.section_dimension ?? [];
  const global: GlobalDimension = data.global_dimension ?? {
    description: '',
    fact_keywords: {},
    highlights: {},
    lowlights: {}
  };

  const toggleSection = (index: number) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(index)) newSet.delete(index);
    else newSet.add(index);
    setExpandedSections(newSet);
  };

  const updateGlobal = (key: keyof GlobalDimension, val: any) => {
    onChange({
      ...data,
      global_dimension: { ...global, [key]: val }
    });
  };

  const updateSection = (index: number, key: keyof SectionDimension, val: any) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], [key]: val };
    onChange({ ...data, section_dimension: newSections });
  };

  // --- NAVIGATION HELPER ---
  const scrollTo = (id: string, expandIndex?: number) => {
    if (expandIndex !== undefined) {
      setExpandedSections(prev => {
        const next = new Set(prev);
        next.add(expandIndex);
        return next;
      });
      setTimeout(() => {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } else {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      
      {/* --- SIDEBAR OUTLINE --- */}
      <div className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
         <div className="p-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 backdrop-blur-sm z-10">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document Outline</h3>
         </div>
         
         <div className="p-2 space-y-1">
            {/* Global Group */}
            <div className="mb-4">
               <button 
                 onClick={() => scrollTo('global-section')}
                 className="w-full text-left px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 group"
               >
                 <span className="material-icons text-sm text-indigo-400 group-hover:text-indigo-600">public</span>
                 Global Dimension
               </button>
               <div className="ml-8 mt-1 space-y-1 border-l-2 border-slate-100">
                  <button onClick={() => scrollTo('global-desc')} className="block w-full text-left pl-3 py-1 text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-r">Description</button>
                  <button onClick={() => scrollTo('global-facts')} className="block w-full text-left pl-3 py-1 text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-r">Fact Keywords</button>
                  <button onClick={() => scrollTo('global-high')} className="block w-full text-left pl-3 py-1 text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-r">Highlights</button>
                  <button onClick={() => scrollTo('global-low')} className="block w-full text-left pl-3 py-1 text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-r">Lowlights</button>
               </div>
            </div>

            {/* Timeline Group */}
            <div>
              <h4 className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Timeline Analysis</h4>
              {sections.map((sec, idx) => (
                 <button
                   key={idx}
                   onClick={() => scrollTo(`section-${idx}`, idx)}
                   className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-indigo-700 rounded-lg flex items-center gap-2 group transition-colors"
                 >
                   <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${expandedSections.has(idx) ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                     {idx + 1}
                   </span>
                   <div className="flex-1 truncate">
                      <span className="font-mono mr-1 opacity-70">[{sec.timestamp || '0:00'}]</span>
                      <span className="truncate">{sec.id || 'No ID'}</span>
                   </div>
                 </button>
              ))}
            </div>
         </div>
      </div>

      {/* --- MAIN EDITOR CONTENT --- */}
      <div className="flex-1 h-full overflow-y-auto p-4 sm:p-8 space-y-8 pb-32 bg-slate-50/50 scroll-smooth" id="editor-scroller">
        
        {/* GLOBAL DIMENSION */}
        <div id="global-section" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-icons text-indigo-400">public</span>
              <h2 className="text-lg font-bold">Global Dimension</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="mb-6" id="global-desc">
              <TranslationUnit 
                label="Song Description" 
                value={global.description} 
                onChange={(val) => updateGlobal('description', val)} 
                multiline 
              />
            </div>

            <div id="global-facts">
                <DictionaryBlock 
                title="Fact Keywords" 
                data={global.fact_keywords}
                onChange={(val) => updateGlobal('fact_keywords', val)}
                />
            </div>

            <div id="global-high">
                <DictionaryBlock 
                title="Creative Highlights" 
                data={global.highlights}
                onChange={(val) => updateGlobal('highlights', val)}
                important
                />
            </div>

            <div id="global-low">
                <DictionaryBlock 
                title="Improvement Areas (Lowlights)" 
                data={global.lowlights}
                onChange={(val) => updateGlobal('lowlights', val)}
                />
            </div>
          </div>
        </div>

        {/* SECTION DIMENSIONS */}
        <div className="space-y-4">
          <h3 className="text-slate-500 font-bold uppercase text-xs tracking-wider px-2">Timeline Analysis</h3>
          
          {sections.map((section, idx) => (
            <div 
              key={idx} 
              id={`section-${idx}`}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in-up" 
              style={{ animationDelay: `${idx * 50}ms` }}
            >
                <div 
                  className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                  onClick={() => toggleSection(idx)}
                >
                  <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">Section ID: {section.id || 'N/A'}</span>
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">
                              {section.timestamp || '00:00'}
                            </span>
                        </div>
                      </div>
                  </div>
                  <span className={`material-icons text-slate-400 transition-transform duration-300 ${expandedSections.has(idx) ? 'rotate-180' : ''}`}>
                      expand_more
                  </span>
                </div>

                {expandedSections.has(idx) && (
                  <div className="p-6 border-t border-slate-100 bg-slate-50/30">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <TranslationUnit 
                            label="Section Description"
                            value={section.description}
                            onChange={(val) => updateSection(idx, 'description', val)}
                            multiline
                        />
                        <TranslationUnit 
                            label="Lyrics / Content"
                            value={section.lyrics}
                            onChange={(val) => updateSection(idx, 'lyrics', val)}
                            multiline
                        />
                      </div>

                      <DictionaryBlock 
                        title="Technical Keywords"
                        data={section.keywords}
                        onChange={(val) => updateSection(idx, 'keywords', val)}
                      />

                      <DictionaryBlock 
                        title="Highlights"
                        data={section.highlights}
                        onChange={(val) => updateSection(idx, 'highlights', val)}
                        important
                      />
                      
                      <DictionaryBlock 
                        title="Lowlights"
                        data={section.lowlights}
                        onChange={(val) => updateSection(idx, 'lowlights', val)}
                      />
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default JsonEditor;
