import React, { useState, useEffect } from 'react';
import { buildTranslationMapFromJson, diagnoseMatch, TranslationMap } from '../utils/matcher';

interface TranslationJsonInputProps {
  originalData: any | null;
  onLoad: (args: { map: TranslationMap; rawText: string; diagnostics: ReturnType<typeof diagnoseMatch> }) => void;
  collapsed?: boolean;
  height?: number;
  onToggle?: () => void;
  onBeginResize?: (clientY: number) => void;
  externalText?: string;
}

const TranslationJsonInput: React.FC<TranslationJsonInputProps> = ({ originalData, onLoad, collapsed = false, height = 180, onToggle, onBeginResize, externalText }) => {
  const [text, setText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [diag, setDiag] = useState<ReturnType<typeof diagnoseMatch> | null>(null);

  useEffect(() => {
    if (typeof externalText === 'string' && externalText !== text) {
      setText(externalText);
      try {
        const tjson = externalText.trim() ? JSON.parse(externalText) : {};
        const diagnostics = originalData ? diagnoseMatch(originalData, tjson) : { missingPaths: [], extraPaths: [], typeMismatches: [] };
        setDiag(diagnostics);
        setParseError(null);
      } catch (err: any) {
        // 外部文本同步时解析错误也给用户提示
        console.warn('TranslationJsonInput: External sync parse error ignored', err);
        setDiag(null);
        if (externalText.trim()) {
          const errorMsg = err?.message ? `JSON 语法错误: ${err.message}` : '译文 JSON 语法错误';
          setParseError(errorMsg);
        } else {
          setParseError(null);
        }
      }
    }
  }, [externalText, originalData]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    if (!newText.trim()) {
      setParseError(null);
      setDiag(null);
      onLoad({ map: {}, rawText: '', diagnostics: { missingPaths: [], extraPaths: [], typeMismatches: [] } });
      return;
    }
    try {
      const tjson = JSON.parse(newText);
      const map = buildTranslationMapFromJson(tjson);
      const diagnostics = originalData ? diagnoseMatch(originalData, tjson) : { missingPaths: [], extraPaths: [], typeMismatches: [] };
      setParseError(null);
      setDiag(diagnostics);
      onLoad({ map, rawText: newText, diagnostics });
    } catch (e: any) {
      const errorMsg = e?.message ? `JSON 语法错误: ${e.message}` : '译文 JSON 语法错误';
      setParseError(errorMsg);
      setDiag(null);
    }
  };

  const renderDiag = () => {
    if (!diag) return null;
    const { missingPaths, extraPaths, typeMismatches } = diag;
    return (
      <div className="mt-2 space-y-2">
        <div className="text-xs text-slate-600">匹配统计：缺失 {missingPaths.length}，多余 {extraPaths.length}，类型不一致 {typeMismatches.length}</div>
        {(missingPaths.length > 0 || extraPaths.length > 0 || typeMismatches.length > 0) && (
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-500">查看详情</summary>
            {missingPaths.length > 0 && (
              <div className="mt-1">
                <div className="font-bold text-red-600">缺失路径</div>
                <ul className="list-disc pl-5 text-slate-700">
                  {missingPaths.slice(0, 50).map((p) => (<li key={p}>{p}</li>))}
                  {missingPaths.length > 50 && <li>… 共 {missingPaths.length} 项</li>}
                </ul>
              </div>
            )}
            {extraPaths.length > 0 && (
              <div className="mt-2">
                <div className="font-bold text-amber-600">多余路径</div>
                <ul className="list-disc pl-5 text-slate-700">
                  {extraPaths.slice(0, 50).map((p) => (<li key={p}>{p}</li>))}
                  {extraPaths.length > 50 && <li>… 共 {extraPaths.length} 项</li>}
                </ul>
              </div>
            )}
            {typeMismatches.length > 0 && (
              <div className="mt-2">
                <div className="font-bold text-indigo-600">类型不一致</div>
                <ul className="list-disc pl-5 text-slate-700">
                  {typeMismatches.slice(0, 50).map((m) => (<li key={m.path}>{m.path}: {m.originalType} → {m.translationType}</li>))}
                  {typeMismatches.length > 50 && <li>… 共 {typeMismatches.length} 项</li>}
                </ul>
              </div>
            )}
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="relative pb-4 flex flex-col bg-white border-t border-slate-200 flex-shrink-0 overflow-hidden transition-[height] duration-200 ease-in-out" style={{ height: collapsed ? 8 : height }}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="material-icons text-indigo-400">translate</span>
          <span className="text-slate-700 font-mono text-xs font-bold">译文/参考 JSON</span>
          {parseError && (
            <span className="text-xs bg-red-500/20 text-red-600 px-2 py-0.5 rounded">{parseError}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors ${collapsed ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
            title={collapsed ? '展开译文 JSON' : '收起译文 JSON'}
            aria-expanded={!collapsed}
          >
            <span className="material-icons text-base">{collapsed ? 'expand_more' : 'expand_less'}</span>
            Translation JSON
          </button>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden pb-5">
        <textarea
          value={text}
          onChange={handleChange}
          placeholder='粘贴完整中文译文 JSON（结构需与原文一致）'
          className="w-full h-full bg-slate-900 text-slate-200 font-mono text-xs p-4 resize-none focus:outline-none"
          spellCheck={false}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-2 bg-indigo-500/80 hover:bg-indigo-500 cursor-row-resize flex items-center justify-center z-10"
          onMouseDown={(e) => onBeginResize && onBeginResize(e.clientY)}
          onTouchStart={(e) => onBeginResize && onBeginResize(e.touches[0].clientY)}
          aria-label="Drag to resize"
        >
          <div className="w-[48px] h-px bg-white/90 rounded"></div>
        </div>
      </div>
      <div className="px-4 pb-3">
        {renderDiag()}
      </div>
    </div>
  );
};

export default TranslationJsonInput;
