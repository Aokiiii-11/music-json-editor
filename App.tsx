import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MusicData, ApiSettings, ApiProvider } from './types';
import JsonEditor from './components/JsonEditor';
import TranslationJsonInput from './components/TranslationJsonInput';
import { collectStringPaths, getByPath } from './utils/jsonPath';
import { buildTranslationMapFromJson, diagnoseMatch, TranslationMap } from './utils/matcher';
import Settings from './components/Settings';
import { translateJson } from './services/geminiService';

enum AppMode {
  EDITOR = 'EDITOR',
  SETTINGS = 'SETTINGS',
}

const DEFAULT_API_SETTINGS: ApiSettings = {
  provider: ApiProvider.GEMINI,
  geminiApiKey: '',
  customUrl: '',
  customMethod: 'POST',
  customHeaders: '{\n  "Content-Type": "application/json"\n}',
  customBodyTemplate: '{\n  "messages": [\n    { "role": "user", "content": "{{prompt}}" }\n  ]\n}',
  customResponsePath: 'choices.0.message.content'
};

const DEFAULT_PROMPT = `你是翻译专家，并且是音乐爱好者，你会讲输入的各个国家的语言、音乐描述、术语、歌词等音乐信息准确的翻译成中文。

RULES:
1. Keep the JSON structure exactly the same. Do not change keys.
2. For every string value that is English text, translate it to Chinese.
3. Format the final value as "Original English Value | Chinese Translation".
4. If the value is empty, keep it empty.
5. If the value is a number or technical ID (like UUID), keep it as is.
6. Ensure music terminology is accurate (e.g., "Verse", "Chorus", "BPM", "Chord Progression").

Example:
Input: { "description": "High energy rock song" }
Output: { "description": "High energy rock song | 高能量摇滚歌曲" }`;

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.EDITOR);
  
  // State for the raw text and the parsed data
  const [jsonText, setJsonText] = useState('');
  const [data, setData] = useState<MusicData | null>(null);
  
  // Settings State
  const [apiSettings, setApiSettings] = useState<ApiSettings>(DEFAULT_API_SETTINGS);
  const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_PROMPT);

  // Metadata
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [isRawCollapsed, setIsRawCollapsed] = useState(false);
  const [rawHeight, setRawHeight] = useState<number>(300);
  const rawHeightRef = useRef(rawHeight);
  const [isTransCollapsed, setIsTransCollapsed] = useState(false);
  const [transHeight, setTransHeight] = useState<number>(180);
  const transHeightRef = useRef(transHeight);
  const [viewMode, setViewMode] = useState<'auto'|'source_only'|'dual'>('auto');
  const [diffModeEnabled, setDiffModeEnabled] = useState<boolean>(false);

  // Translation (Reference) State
  const [translationJsonText, setTranslationJsonText] = useState('');
  const [translationMap, setTranslationMap] = useState<TranslationMap>({});
  const [translationDiag, setTranslationDiag] = useState<ReturnType<typeof diagnoseMatch> | null>(null);
  const effectiveMode = React.useMemo<'source_only'|'dual'>(() => {
    if (viewMode !== 'auto') return viewMode === 'source_only' ? 'source_only' : 'dual';
    if (data && !translationJsonText.trim() && (!translationMap || Object.keys(translationMap).length === 0)) return 'source_only';
    if (data && translationJsonText.trim() && translationDiag) return 'dual';
    return 'dual';
  }, [viewMode, data, translationJsonText, translationMap, translationDiag]);
  // Undo/Redo History
  const [past, setPast] = useState<MusicData[]>([]);
  const [future, setFuture] = useState<MusicData[]>([]);

  const extractBilingual = (root: any): { original: any; map: TranslationMap } => {
    const map: TranslationMap = {};
    const walk = (node: any): any => {
      if (typeof node === 'string') {
        const parts = node.split('|');
        if (parts.length > 1) {
          const en = parts[0].trim();
          const cn = parts.slice(1).join('|').trim();
          return { en, cn } as any; // marker handled in parent
        }
        return node;
      }
      if (Array.isArray(node)) {
        return node.map(walk).map((v) => (typeof v === 'object' && v && 'en' in v ? (v as any).en : v));
      }
      if (node && typeof node === 'object') {
        const out: any = {};
        for (const k of Object.keys(node)) {
          const v = walk(node[k]);
          if (typeof v === 'object' && v && 'en' in v) {
            out[k] = (v as any).en;
          } else {
            out[k] = v;
          }
        }
        return out;
      }
      return node;
    };
    // Build original-only
    const original = walk(root);
    // Build map from original + root by re-traversal for strings with pipes
    const paths = collectStringPaths(root);
    for (const p of paths) {
      const val = getByPath(root, p);
      if (typeof val === 'string') {
        const parts = val.split('|');
        if (parts.length > 1) map[p] = parts.slice(1).join('|').trim();
      }
    }
    return { original, map };
  };

  // Load Settings on Mount
  useEffect(() => {
    const storedApi = localStorage.getItem('bmje_api_settings');
    if (storedApi) {
      try {
        setApiSettings(JSON.parse(storedApi));
      } catch (e) {
        console.error("Failed to parse stored API settings");
      }
    }

    const storedPrompt = localStorage.getItem('bmje_custom_prompt');
    if (storedPrompt) {
      setCustomPrompt(storedPrompt);
    }

    const storedCollapsed = localStorage.getItem('bmje_raw_collapsed');
    if (storedCollapsed === '1' || storedCollapsed === 'true') {
      setIsRawCollapsed(true);
    }
    const storedHeight = localStorage.getItem('bmje_raw_height');
    const defaultHeight = Math.round(window.innerHeight * 0.35);
    if (storedHeight) {
      const h = parseInt(storedHeight, 10);
      setRawHeight(Number.isFinite(h) ? Math.max(100, h) : defaultHeight);
    } else {
      setRawHeight(defaultHeight);
    }

    const storedTransCollapsed = localStorage.getItem('bmje_trans_collapsed');
    if (storedTransCollapsed === '1' || storedTransCollapsed === 'true') {
      setIsTransCollapsed(true);
    }
    const storedTransHeight = localStorage.getItem('bmje_trans_height');
    const defaultTransHeight = Math.round(window.innerHeight * 0.25);
    if (storedTransHeight) {
      const th = parseInt(storedTransHeight, 10);
      setTransHeight(Number.isFinite(th) ? Math.max(120, th) : defaultTransHeight);
    } else {
      setTransHeight(defaultTransHeight);
    }
  }, []);

  useEffect(() => {
    rawHeightRef.current = rawHeight;
  }, [rawHeight]);
  useEffect(() => {
    transHeightRef.current = transHeight;
  }, [transHeight]);

  // Save Settings Handlers
  const handleSaveApiSettings = (settings: ApiSettings) => {
    setApiSettings(settings);
    localStorage.setItem('bmje_api_settings', JSON.stringify(settings));
  };

  const handleSavePrompt = (prompt: string) => {
    setCustomPrompt(prompt);
    localStorage.setItem('bmje_custom_prompt', prompt);
  };

  // --- HANDLERS ---

  // 1. Handle Text Input (Top Window)
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setJsonText(newText);
    
    if (!newText.trim()) {
      setData(null);
      setParseError(null);
      return;
    }

    try {
      const parsed = JSON.parse(newText);
      const { original, map } = extractBilingual(parsed);
      setPast((prev) => (data ? [...prev, data] : prev));
      setFuture([]);
      setData(original);
      setTranslationMap(map);
      setTranslationDiag(diagnoseMatch(original, map && Object.keys(map).length ? parsed : original));
      setParseError(null);
      setLastUpdated(new Date());
    } catch (err) {
      // Don't clear data immediately on syntax error to allow typing, 
      // but show error state
      setParseError("Invalid JSON syntax");
    }
  };

  // 2. Handle Visual Editor Change (Bottom Window)
  const handleVisualChange = useCallback((newData: MusicData) => {
    setPast((prev) => (data ? [...prev, data] : prev));
    setFuture([]);
    setData(newData);
    setJsonText(JSON.stringify(newData, null, 2));
    setLastUpdated(new Date());
  }, [data]);

  // 3. Auto Translate
  const handleTranslate = async () => {
    if (!data) return;
    setIsTranslating(true);
    try {
      const bilingual = await translateJson(data, customPrompt, apiSettings);
      // Build Chinese-only JSON based on bilingual strings
      const paths = collectStringPaths(bilingual);
      const chineseOnly: any = Array.isArray(bilingual) ? [] : {};
      const cloneStack: { src: any; dst: any }[] = [{ src: bilingual, dst: chineseOnly }];
      while (cloneStack.length) {
        const { src, dst } = cloneStack.pop()!;
        if (typeof src === 'string') {
          const parts = String(src).split('|');
          const cn = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
          // assign handled by parent branch
        } else if (Array.isArray(src)) {
          const arr: any[] = new Array(src.length);
          for (let i = 0; i < src.length; i++) {
            const s = src[i];
            if (typeof s === 'string') {
              const parts = String(s).split('|');
              arr[i] = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
            } else if (Array.isArray(s)) {
              const child: any[] = [];
              arr[i] = child;
              cloneStack.push({ src: s, dst: child });
            } else if (s && typeof s === 'object') {
              const child: any = {};
              arr[i] = child;
              cloneStack.push({ src: s, dst: child });
            } else {
              arr[i] = s;
            }
          }
          Object.assign(dst, arr);
        } else if (src && typeof src === 'object') {
          for (const k of Object.keys(src)) {
            const s = src[k];
            if (typeof s === 'string') {
              const parts = String(s).split('|');
              (dst as any)[k] = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
            } else if (Array.isArray(s)) {
              const child: any[] = [];
              (dst as any)[k] = child;
              cloneStack.push({ src: s, dst: child });
            } else if (s && typeof s === 'object') {
              const child: any = {};
              (dst as any)[k] = child;
              cloneStack.push({ src: s, dst: child });
            } else {
              (dst as any)[k] = s;
            }
          }
        }
      }
      const map = buildTranslationMapFromJson(chineseOnly);
      const diagnostics = diagnoseMatch(data, chineseOnly);
      setTranslationMap(map);
      setTranslationDiag(diagnostics);
      setTranslationJsonText(JSON.stringify(chineseOnly, null, 2));
      alert('Translation generated as reference. Original JSON unchanged.');
    } catch (error: any) {
      console.error("Translation error:", error);
      alert(`Translation failed: ${error?.message || "Unknown error"}. Check console for details.`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Deprecated cleanData removed: we now export original JSON directly

  // 5. Export
  const handleExport = (clean: boolean) => {
    setIsExporting(true);
    // Robust data retrieval: Try state first, then try parsing text
    let exportData = data;
    
    if (!exportData) {
        if (!jsonText.trim()) {
            alert("The input is empty. Paste some JSON first.");
            return;
        }
        try {
            exportData = JSON.parse(jsonText);
        } catch (e) {
            alert("Cannot export: Invalid JSON syntax in the input box.");
            return;
        }
    }
    
    const defaultName = clean ? 'clean_music_data' : 'original_music_data';
    const userFilename = window.prompt("Enter filename for export (without extension):", defaultName);
    if (userFilename === null) return;
    const baseName = userFilename.trim() || defaultName;
    const filename = baseName.endsWith('.json') ? baseName : `${baseName}.json`;
    
    try {
        const dataToExport = exportData;
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.info('Exported:', filename);
        alert('Exported: ' + filename);
    } catch (e) {
        console.error('Export failed:', e);
        alert("Export failed: " + (e as Error).message);
    } finally {
        setIsExporting(false);
    }
  };

  // 6. Format / Parse Manually
  const handleFormat = () => {
    if (!jsonText.trim()) return;
    try {
      const parsed = JSON.parse(jsonText);
      const { original, map } = extractBilingual(parsed);
      // Update text to be pretty
      setJsonText(JSON.stringify(original, null, 2));
      // Ensure data is set
      setPast((prev) => (data ? [...prev, data] : prev));
      setFuture([]);
      setData(original);
      setTranslationMap(map);
      setParseError(null);
      setLastUpdated(new Date());
    } catch (e) {
      setParseError("Invalid JSON syntax");
    }
  };

  const toggleRawPane = () => {
    const next = !isRawCollapsed;
    setIsRawCollapsed(next);
    localStorage.setItem('bmje_raw_collapsed', next ? '1' : '0');
  };
  const toggleTransPane = () => {
    const next = !isTransCollapsed;
    setIsTransCollapsed(next);
    localStorage.setItem('bmje_trans_collapsed', next ? '1' : '0');
  };

  const beginResize = (clientY: number) => {
    const startY = clientY;
    const startHeight = rawHeightRef.current;
    const minH = 100;
    const onMove = (y: number) => {
      const delta = y - startY;
      const next = Math.max(minH, startHeight + delta);
      setIsRawCollapsed(false);
      setRawHeight(next);
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientY);
    const onTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientY);
    const onUp = () => {
      localStorage.setItem('bmje_raw_height', String(rawHeightRef.current));
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('mouseup', onUp, { passive: true });
    window.addEventListener('touchend', onUp, { passive: true });
  };
  const beginResizeTrans = (clientY: number) => {
    const startY = clientY;
    const startHeight = transHeightRef.current;
    const minH = 120;
    const onMove = (y: number) => {
      const delta = y - startY;
      const next = Math.max(minH, startHeight + delta);
      setIsTransCollapsed(false);
      setTransHeight(next);
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientY);
    const onTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientY);
    const onUp = () => {
      localStorage.setItem('bmje_trans_height', String(transHeightRef.current));
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('mouseup', onUp, { passive: true });
    window.addEventListener('touchend', onUp, { passive: true });
  };

  // --- RENDER HELPERS ---

  const renderContent = () => {
    if (mode === AppMode.SETTINGS) {
        return (
          <Settings 
            onClose={() => setMode(AppMode.EDITOR)}
            apiSettings={apiSettings}
            onSaveApiSettings={handleSaveApiSettings}
            customPrompt={customPrompt}
            onSavePrompt={handleSavePrompt}
          />
        );
    }

    return (
      <div className="flex flex-col h-full overflow-hidden">
         {/* --- TOP PANE: RAW JSON (Persistent) --- */}
         <div className="flex flex-col bg-slate-900 border-b-4 border-indigo-500 shadow-md flex-shrink-0 z-20 overflow-hidden transition-[height] duration-200 ease-in-out" style={{ height: isRawCollapsed ? 8 : rawHeight }}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
               <div className="flex items-center gap-3">
                  <span className="material-icons text-indigo-400">code</span>
                  <span className="text-slate-200 font-mono text-sm font-bold">RAW JSON INPUT</span>
                  {parseError && (
                    <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded flex items-center gap-1">
                      <span className="material-icons text-[12px]">error</span> {parseError}
                    </span>
                  )}
               </div>
               <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                  <button 
                    onClick={handleFormat}
                    className="flex items-center gap-2 px-3 py-1 bg-slate-700 hover:bg-indigo-600 text-slate-200 hover:text-white rounded text-xs font-bold transition-colors border border-slate-600 hover:border-indigo-500"
                    title="Parse JSON and update editor without translating"
                  >
                    <span className="material-icons text-sm">auto_fix_high</span>
                    Format & Parse
                  </button>
                  <button
                    onClick={toggleRawPane}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors ${isRawCollapsed ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500' : 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-indigo-600 hover:text-white'}`}
                    title={isRawCollapsed ? '展开' : '收起'}
                    aria-expanded={!isRawCollapsed}
                  >
                    <span className="material-icons text-base">{isRawCollapsed ? 'expand_more' : 'expand_less'}</span>
                    JSON
                  </button>
                  {lastUpdated && (
                    <span className="flex items-center gap-1 animate-fade-in pl-2 border-l border-slate-700">
                       <span className="material-icons text-[12px]">update</span>
                       Updated: {lastUpdated.toLocaleTimeString()}
                    </span>
                  )}
               </div>
            </div>
            
            {/* Text Area */}
            <div className="flex-1 relative">
              <textarea
                value={jsonText}
                onChange={handleTextChange}
                placeholder='Paste your JSON (Original or Bilingual) here...'
                className="w-full h-full bg-slate-900 text-slate-300 font-mono text-xs p-4 resize-none focus:outline-none focus:ring-inset focus:ring-2 focus:ring-indigo-500/50 leading-relaxed"
                spellCheck={false}
              />
              <div
                className="absolute bottom-0 left-0 right-0 h-2 bg-indigo-500/80 hover:bg-indigo-500 cursor-row-resize flex items-center justify-center z-10"
                onMouseDown={(e) => beginResize(e.clientY)}
                onTouchStart={(e) => beginResize(e.touches[0].clientY)}
                aria-label="Drag to resize"
              >
                <div className="w-[48px] h-px bg-white/90 rounded"></div>
              </div>
            </div>
         </div>

         {/* --- TRANSLATION INPUT: REFERENCE JSON --- */}
         <TranslationJsonInput
            originalData={data}
            onLoad={({ map, rawText, diagnostics }) => {
              setTranslationMap(map);
              setTranslationJsonText(rawText);
              setTranslationDiag(diagnostics);
            }}
            collapsed={isTransCollapsed}
            height={transHeight}
            onToggle={toggleTransPane}
            onBeginResize={beginResizeTrans}
         />

         {/* --- MIDDLE BAR: ACTIONS --- */}
         <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between shadow-sm z-10 flex-shrink-0 h-16">
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-sm">Visual Editor</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {data ? 'Active' : 'Waiting for JSON...'}
                    </span>
                </div>
                <button
                  onClick={() => {
                    if (!past.length || !data) return;
                    const prev = past[past.length - 1];
                    setPast(past.slice(0, -1));
                    setFuture([...future, data]);
                    setData(prev);
                    setJsonText(JSON.stringify(prev, null, 2));
                    setLastUpdated(new Date());
                  }}
                  disabled={!past.length || !data}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    !past.length || !data
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="撤回 (Cmd/Ctrl+Z)"
                >
                  <span className="material-icons text-base">undo</span>
                </button>
                <button
                  onClick={() => {
                    if (!future.length || !data) return;
                    const next = future[future.length - 1];
                    setFuture(future.slice(0, -1));
                    setPast([...past, data]);
                    setData(next);
                    setJsonText(JSON.stringify(next, null, 2));
                    setLastUpdated(new Date());
                  }}
                  disabled={!future.length || !data}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    !future.length || !data
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="取消撤回 (Shift+Cmd/Ctrl+Z)"
                >
                  <span className="material-icons text-base">redo</span>
                </button>
                <button
                  onClick={toggleRawPane}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${isRawCollapsed ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                  title={isRawCollapsed ? '展开原始 JSON' : '收起原始 JSON'}
                  aria-expanded={!isRawCollapsed}
                >
                  <span className="material-icons text-base">{isRawCollapsed ? 'expand_more' : 'expand_less'}</span>
                  JSON Pane
                </button>
                <button
                  onClick={toggleTransPane}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${isTransCollapsed ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                  title={isTransCollapsed ? '展开译文 JSON' : '收起译文 JSON'}
                  aria-expanded={!isTransCollapsed}
                >
                  <span className="material-icons text-base">{isTransCollapsed ? 'expand_more' : 'expand_less'}</span>
                  Translation Pane
                </button>
            </div>

            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setMode(AppMode.SETTINGS)}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors mr-2 flex items-center gap-1"
                    title="Settings"
                >
                    <span className="material-icons">settings</span>
                </button>
                <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                  <span className="text-xs font-semibold">Compare Mode</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-300">
                    {viewMode === 'auto' ? (effectiveMode === 'source_only' ? 'Auto·原文' : 'Auto·双语') : (viewMode === 'source_only' ? '原文' : '双语')}
                  </span>
                  <button
                    onClick={() => setViewMode(viewMode === 'auto' ? 'source_only' : (viewMode === 'source_only' ? 'dual' : 'auto'))}
                    className="px-2 py-1 text-xs font-medium bg-white border border-slate-300 rounded hover:bg-slate-50"
                    title="切换对照模式"
                  >
                    Toggle
                  </button>
                  <div className="w-px h-4 bg-slate-300 mx-1"></div>
                  <span className="text-xs font-semibold">Diff 模式</span>
                  <button
                    onClick={() => setDiffModeEnabled(!diffModeEnabled)}
                    className={`px-2 py-1 text-xs font-medium rounded border ${diffModeEnabled ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                    title="开启/关闭 Diff 模式"
                  >
                    {diffModeEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                
                <button 
                    onClick={handleTranslate}
                    disabled={isTranslating || !data}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${
                        isTranslating || !data
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                    }`}
                >
                   {isTranslating ? (
                       <span className="animate-spin material-icons text-sm">refresh</span>
                   ) : (
                       <span className="material-icons text-sm">translate</span>
                   )}
                   Auto Translate
                </button>

                <div className="h-6 w-px bg-slate-200 mx-2"></div>

                <button 
                    onClick={() => handleExport(false)}
                    disabled={isExporting || (!data && !jsonText.trim())}
                    className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium text-xs hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                    title="Export current original JSON"
                >
                    {isExporting ? (
                      <span className="material-icons text-sm animate-spin">refresh</span>
                    ) : (
                      <span className="material-icons text-sm">save</span>
                    )}
                    {isExporting ? 'Exporting…' : 'Export Original'}
                </button>

                <button 
                    onClick={() => handleExport(true)}
                    disabled={isExporting || (!data && !jsonText.trim())}
                    className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 text-white rounded-lg font-medium text-xs hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                    title="Export original JSON (same content)"
                >
                    {isExporting ? (
                      <span className="material-icons text-sm animate-spin">refresh</span>
                    ) : (
                      <span className="material-icons text-sm">download</span>
                    )}
                    {isExporting ? 'Exporting…' : 'Export Original (Same)'}
                </button>

                <button 
                    onClick={() => {
                      if (!translationJsonText.trim()) {
                        alert('No translation JSON loaded. Paste or generate it first.');
                        return;
                      }
                      if (translationDiag && translationDiag.missingPaths.length > 0) {
                        const proceed = window.confirm(`Translation has ${translationDiag.missingPaths.length} missing paths. Export anyway?`);
                        if (!proceed) return;
                      }
                      try {
                        const filename = window.prompt('Enter filename for translation (without extension):', 'translation_reference') || 'translation_reference';
                        const baseName = filename.trim();
                        const finalName = baseName.endsWith('.json') ? baseName : `${baseName}.json`;
                        const blob = new Blob([translationJsonText], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = finalName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        alert('Exported: ' + finalName);
                      } catch (e) {
                        alert('Export translation failed');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-medium text-xs hover:bg-indigo-100 transition-colors shadow-sm"
                    title="Export Chinese translation JSON (reference only)"
                >
                    <span className="material-icons text-sm">file_download</span>
                    Export Translation
                </button>
            </div>
         </div>

         {/* --- BOTTOM PANE: VISUAL EDITOR --- */}
         <div className="flex-1 overflow-hidden relative bg-slate-50">
            {isTranslating && (
                <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                    <p className="text-slate-600 font-medium text-sm">Translating...</p>
                    {apiSettings.provider === ApiProvider.CUSTOM && (
                       <p className="text-xs text-slate-400 mt-1">Using Custom API</p>
                    )}
                </div>
            )}
            
            {data ? (
               <JsonEditor 
                 data={data} 
                 onChange={handleVisualChange} 
                 translationMap={effectiveMode === 'dual' ? translationMap : undefined}
                 compareMode={effectiveMode}
                 diffModeEnabled={diffModeEnabled}
                 translationDiag={effectiveMode === 'dual' ? translationDiag : null}
               />
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <span className="material-icons text-6xl mb-4 text-slate-300">code_off</span>
                  <p>Paste JSON above to start editing</p>
               </div>
            )}
         </div>
      </div>
    );
  };

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
      const isRedo = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z';
      if (isUndo) {
        e.preventDefault();
        if (past.length && data) {
          const prev = past[past.length - 1];
          setPast(past.slice(0, -1));
          setFuture([...future, data]);
          setData(prev);
          setJsonText(JSON.stringify(prev, null, 2));
          setLastUpdated(new Date());
        }
      } else if (isRedo) {
        e.preventDefault();
        if (future.length && data) {
          const next = future[future.length - 1];
          setFuture(future.slice(0, -1));
          setPast([...past, data]);
          setData(next);
          setJsonText(JSON.stringify(next, null, 2));
          setLastUpdated(new Date());
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [past, future, data]);

  return (
    <div className="flex h-screen bg-slate-50">
      <main className="flex-1 overflow-hidden relative">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
