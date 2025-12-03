import React, { useState, useEffect, useCallback } from 'react';
import { MusicData, ApiSettings, ApiProvider } from './types';
import JsonEditor from './components/JsonEditor';
import Settings from './components/Settings';
import ChatBot from './components/ChatBot';
import { translateJson } from './services/geminiService';

enum AppMode {
  EDITOR = 'EDITOR',
  SETTINGS = 'SETTINGS',
}

const DEFAULT_API_SETTINGS: ApiSettings = {
  provider: ApiProvider.GEMINI,
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
  }, []);

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
      setData(parsed);
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
    setData(newData);
    // Sync back to text
    setJsonText(JSON.stringify(newData, null, 2));
    setLastUpdated(new Date());
  }, []);

  // 3. Auto Translate
  const handleTranslate = async () => {
    if (!data) return;
    setIsTranslating(true);
    try {
      const translated = await translateJson(data, customPrompt, apiSettings);
      handleVisualChange(translated);
    } catch (error: any) {
      console.error("Translation error:", error);
      alert(`Translation failed: ${error?.message || "Unknown error"}. Check console for details.`);
    } finally {
      setIsTranslating(false);
    }
  };

  // 4. Clean Data Helper (Strips Chinese)
  const cleanData = (obj: any): any => {
    if (typeof obj === 'string') {
      // Split by pipe and take the first part (Original)
      return obj.split('|')[0].trim();
    } else if (Array.isArray(obj)) {
      return obj.map(cleanData);
    } else if (typeof obj === 'object' && obj !== null) {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = cleanData(obj[key]);
      }
      return newObj;
    }
    return obj;
  };

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
    
    const defaultName = clean ? 'clean_music_data' : 'bilingual_music_data';
    const userFilename = window.prompt("Enter filename for export (without extension):", defaultName);
    if (userFilename === null) return;
    const baseName = userFilename.trim() || defaultName;
    const filename = baseName.endsWith('.json') ? baseName : `${baseName}.json`;
    
    try {
        const dataToExport = clean ? cleanData(exportData) : exportData;
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
      // Update text to be pretty
      setJsonText(JSON.stringify(parsed, null, 2));
      // Ensure data is set
      setData(parsed);
      setParseError(null);
      setLastUpdated(new Date());
    } catch (e) {
      setParseError("Invalid JSON syntax");
    }
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
         <div className="h-[35%] flex flex-col bg-slate-900 border-b-4 border-indigo-500 shadow-md flex-shrink-0 z-20">
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
            </div>
         </div>

         {/* --- MIDDLE BAR: ACTIONS --- */}
         <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between shadow-sm z-10 flex-shrink-0 h-16">
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-sm">Visual Editor</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {data ? 'Active' : 'Waiting for JSON...'}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button 
                  onClick={() => setMode(AppMode.SETTINGS)}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors mr-2 flex items-center gap-1"
                  title="Settings"
                >
                    <span className="material-icons">settings</span>
                </button>
                
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
                    title="Save current state (Bilingual)"
                >
                    {isExporting ? (
                      <span className="material-icons text-sm animate-spin">refresh</span>
                    ) : (
                      <span className="material-icons text-sm">save</span>
                    )}
                    {isExporting ? 'Exporting…' : 'Save Progress'}
                </button>

                <button 
                    onClick={() => handleExport(true)}
                    disabled={isExporting || (!data && !jsonText.trim())}
                    className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 text-white rounded-lg font-medium text-xs hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                    title="Removes translations and keeps original structure"
                >
                    {isExporting ? (
                      <span className="material-icons text-sm animate-spin">refresh</span>
                    ) : (
                      <span className="material-icons text-sm">download</span>
                    )}
                    {isExporting ? 'Exporting…' : 'Export Original (Clean)'}
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
               <JsonEditor data={data} onChange={handleVisualChange} />
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

  return (
    <div className="flex h-screen bg-slate-50">
      <main className="flex-1 overflow-hidden relative">
        {renderContent()}
        {mode === AppMode.EDITOR && data && <ChatBot contextData={data} />}
      </main>
    </div>
  );
};

export default App;
