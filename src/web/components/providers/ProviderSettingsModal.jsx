import { useState } from 'react';
import { Button } from '../ui/Button';
import { X, Cpu, Layers } from 'lucide-react';

export function ProviderSettingsModal({ form, setForm, larkMapping, setLarkMapping, larkConfig, setLarkConfig, onTestLarkConnection, testingLarkConnection, onClose, onSave, loading }) {
  const [showLarkConfig, setShowLarkConfig] = useState(false);

  function update(provider, patch) {
    setForm(prev => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));
  }

  function updateMapping(section, key, value) {
    setLarkMapping({
      ...larkMapping,
      [section]: {
        ...larkMapping[section],
        [key]: value,
      },
    });
  }

  return (
    <div className="modal-overlay flex items-center justify-center fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm p-4">
      <div className="modal modal-wide w-full max-w-2xl bg-slate-900 border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="modal-header flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Cấu hình API Key & Lark Base</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-white rounded-md">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="modal-body p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {form.gemini && (
            <div className="p-4 rounded-lg bg-slate-950 border border-border space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">G</div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">Gemini API Key</span>
                  <span className="text-[10px] text-slate-400">{form.gemini.hasKey ? 'Đã có key trên server' : 'Chưa có key'}</span>
                </div>
              </div>
              <input 
                className="w-full h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                type="password" 
                value={form.gemini.key} 
                onChange={e => update('gemini', { key: e.target.value })} 
                placeholder={form.gemini.hasKey ? 'Để trống để giữ key cũ' : 'Nhập API key'} 
              />
            </div>
          )}

          {form.codex && (
            <div className="p-4 rounded-lg bg-slate-950 border border-border space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-purple-600 text-white font-bold flex items-center justify-center text-sm">C</div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">Codex Config (OpenAI-compatible)</span>
                  <span className="text-[10px] text-slate-400">{form.codex.hasKey ? 'Đã có key trên server' : 'Chưa có key'}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Codex API Key:</span>
                  <input 
                    className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                    type="password" 
                    value={form.codex.key} 
                    onChange={e => update('codex', { key: e.target.value })} 
                    placeholder={form.codex.hasKey ? 'Để trống để giữ key cũ' : 'Nhập API key'} 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">API Base URL:</span>
                  <input 
                    className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                    type="text" 
                    value={form.codex.api_base || ''} 
                    onChange={e => update('codex', { api_base: e.target.value })} 
                    placeholder="https://api.openai.com/v1" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Model Name:</span>
                  <input 
                    className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                    type="text" 
                    value={form.codex.model_name || ''} 
                    onChange={e => update('codex', { model_name: e.target.value })} 
                    placeholder="gpt-4o" 
                  />
                </div>
              </div>
            </div>
          )}

          <Button 
            variant="outline" 
            size="sm"
            type="button" 
            onClick={() => setShowLarkConfig(v => !v)}
            className="w-full text-xs"
          >
            {showLarkConfig ? 'Ẩn cấu hình Lark Base' : 'Cấu hình Lark Base (nâng cao)'}
          </Button>

          {showLarkConfig && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-lg bg-slate-950 border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-cyan-600 text-white font-bold flex items-center justify-center text-sm">L</div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">Lark Base — Kết nối API</span>
                    <span className="text-[10px] text-slate-400">{larkConfig?.hasSecret ? 'Đã có App Secret trên server' : 'Chưa cấu hình'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">App ID:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" value={larkConfig?.app_id || ''} onChange={e => setLarkConfig(prev => ({ ...prev, app_id: e.target.value }))} placeholder="cli_xxxxxxxx" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">App Secret:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" type="password" value={larkConfig?.app_secret || ''} onChange={e => setLarkConfig(prev => ({ ...prev, app_secret: e.target.value }))} placeholder={larkConfig?.hasSecret ? 'Để trống để giữ secret cũ' : 'Nhập App Secret'} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">APPROVED STATUS LABEL:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" value={larkConfig?.approved_status_label || ''} onChange={e => setLarkConfig(prev => ({ ...prev, approved_status_label: e.target.value }))} placeholder="Approved" />
                  </div>
                </div>
                <div className="pt-2">
                  <Button variant="secondary" size="sm" type="button" onClick={onTestLarkConnection} disabled={testingLarkConnection}>
                    {testingLarkConnection ? 'Đang kiểm tra...' : 'Lưu & kiểm tra kết nối'}
                  </Button>
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-950 border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-cyan-600 text-white font-bold flex items-center justify-center text-sm">M</div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">Lark Base Options Mapping</span>
                    <span className="text-[10px] text-slate-400">Ánh xạ single select khi copy/export</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">High:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" value={larkMapping.priority.high} onChange={e => updateMapping('priority', 'high', e.target.value)} placeholder="Cao" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Medium:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" value={larkMapping.priority.medium} onChange={e => updateMapping('priority', 'medium', e.target.value)} placeholder="Trung bình" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Low:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" value={larkMapping.priority.low} onChange={e => updateMapping('priority', 'low', e.target.value)} placeholder="Thấp" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Positive:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" value={larkMapping.type.positive} onChange={e => updateMapping('type', 'positive', e.target.value)} placeholder="Positive" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Negative:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" value={larkMapping.type.negative} onChange={e => updateMapping('type', 'negative', e.target.value)} placeholder="Negative" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Edge Case:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" value={larkMapping.type.edge} onChange={e => updateMapping('type', 'edge', e.target.value)} placeholder="Edge Case" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">UI/UX:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" value={larkMapping.type.ui} onChange={e => updateMapping('type', 'ui', e.target.value)} placeholder="UI/UX" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Security:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" value={larkMapping.type.security} onChange={e => updateMapping('type', 'security', e.target.value)} placeholder="Security" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Performance:</span>
                    <input className="h-9 px-3 rounded-md border border-border bg-slate-900 text-slate-100 text-xs focus:outline-none" value={larkMapping.type.performance} onChange={e => updateMapping('type', 'performance', e.target.value)} placeholder="Performance" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="modal-actions flex items-center justify-end gap-2 border-t border-border pt-4 mt-5">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="default" size="sm" onClick={onSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
