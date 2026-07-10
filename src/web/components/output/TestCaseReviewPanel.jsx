import React from 'react';
import { Button } from '../ui/Button';
import { Check, Info, AlertTriangle, PlusCircle } from 'lucide-react';

const ROW_ORDER = { modify: 0, delete: 0, keep: 1 };

function formatFieldValue(field, value) {
  if (field === 'steps' && Array.isArray(value)) {
    return value.map((step, i) => <div key={i}>{i + 1}. {String(step).replace(/^\s*\d+[.)]\s*/, '')}</div>);
  }
  return value;
}

function changedFieldsMap(changes) {
  const map = new Map();
  for (const c of changes || []) map.set(c.field, c);
  return map;
}

function ReviewRow({ tc, review, decision, onToggleDecision }) {
  const action = review?.action || 'keep';
  const changes = changedFieldsMap(review?.changes);
  const rowClass = action === 'delete' ? 'bg-red-500/10 border-l-2 border-red-500' : action === 'modify' ? 'bg-amber-500/10 border-l-2 border-amber-500' : '';

  function renderCell(field, plainValue) {
    const change = changes.get(field);
    if (action === 'modify' && change) {
      return (
        <td className="p-2 border-b border-border align-top text-xs">
          <div className="text-red-400 line-through mb-1">{formatFieldValue(field, change.oldValue)}</div>
          <div className="text-emerald-400">{formatFieldValue(field, change.newValue)}</div>
        </td>
      );
    }
    return <td className="p-2 border-b border-border align-top text-xs text-slate-300">{formatFieldValue(field, plainValue)}</td>;
  }

  return (
    <tr className={rowClass}>
      <td className="p-2 border-b border-border align-top font-bold text-xs text-amber-500">{tc.id}</td>
      <td className="p-2 border-b border-border align-top text-xs text-slate-400">{tc.module || '-'}</td>
      {renderCell('name', tc.name)}
      {renderCell('type', <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{tc.type}</span>)}
      {renderCell('priority', <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-350">{tc.priority}</span>)}
      {renderCell('preconditions', tc.preconditions)}
      {renderCell('steps', tc.steps || [])}
      {renderCell('expectedResult', tc.expectedResult)}
      <td className="p-2 border-b border-border align-top text-xs min-w-[140px]">
        <div className="flex flex-col gap-2">
          {action === 'modify' && (
            <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-3.5 h-3.5"
                checked={decision === 'apply'}
                onChange={e => onToggleDecision(tc.id, e.target.checked ? 'apply' : 'keep')}
              />
              Áp dụng sửa
            </label>
          )}
          {action === 'delete' && (
            <label className="flex items-center gap-1.5 text-xs text-red-400 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border bg-slate-950 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 w-3.5 h-3.5"
                checked={decision === 'remove'}
                onChange={e => onToggleDecision(tc.id, e.target.checked ? 'remove' : 'keep')}
              />
              Xoá case này
            </label>
          )}
          {action === 'keep' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase">
              <Check className="w-3.5 h-3.5" /> Đạt
            </span>
          )}
          {review?.reason && <div className="text-[10px] text-slate-400 mt-1 italic leading-normal">{review.reason}</div>}
        </div>
      </td>
    </tr>
  );
}

export function TestCaseReviewPanel({
  testCases,
  review,
  decisions,
  newSuggestionDecisions,
  onToggleDecision,
  onToggleSuggestion,
  onAcceptAll,
  onKeepAll,
  onApply,
  onDismiss,
}) {
  const reviewsById = new Map((review.reviews || []).map(r => [r.id, r]));
  const modifyCount = (review.reviews || []).filter(r => r.action === 'modify').length;
  const deleteCount = (review.reviews || []).filter(r => r.action === 'delete').length;
  const newCount = (review.newSuggestions || []).length;
  const sortedTestCases = [...testCases].sort((a, b) => {
    const orderA = ROW_ORDER[reviewsById.get(a.id)?.action || 'keep'];
    const orderB = ROW_ORDER[reviewsById.get(b.id)?.action || 'keep'];
    return orderA - orderB;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border border-border bg-slate-900/40 p-4 rounded-md">
        <div className="space-y-1">
          {review.summary && <p className="text-xs text-slate-350 leading-relaxed">{review.summary}</p>}
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
            {modifyCount} đề xuất sửa · {deleteCount} đề xuất xoá · {newCount} case mới
          </div>
        </div>
        <div className="flex items-center gap-2 flex-nowrap shrink-0">
          <Button variant="outline" size="sm" onClick={onAcceptAll} className="whitespace-nowrap">Áp dụng tất cả</Button>
          <Button variant="outline" size="sm" onClick={onKeepAll} className="whitespace-nowrap">Giữ nguyên</Button>
          <Button variant="ghost" size="sm" onClick={onDismiss} className="whitespace-nowrap">Bỏ qua</Button>
          <Button variant="default" size="sm" onClick={onApply} className="whitespace-nowrap">Áp dụng</Button>
        </div>
      </div>

      <div className="tc-table-wrapper">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-900 border-b border-border">
              <th className="p-2 text-xs font-semibold text-slate-400">TC ID</th>
              <th className="p-2 text-xs font-semibold text-slate-400">Module</th>
              <th className="p-2 text-xs font-semibold text-slate-400">Name</th>
              <th className="p-2 text-xs font-semibold text-slate-400">Type</th>
              <th className="p-2 text-xs font-semibold text-slate-400">Priority</th>
              <th className="p-2 text-xs font-semibold text-slate-400">Preconditions</th>
              <th className="p-2 text-xs font-semibold text-slate-400">Steps</th>
              <th className="p-2 text-xs font-semibold text-slate-400">Expected</th>
              <th className="p-2 text-xs font-semibold text-slate-400">Đề xuất</th>
            </tr>
          </thead>
          <tbody>
            {sortedTestCases.map(tc => (
              <ReviewRow
                key={tc.id}
                tc={tc}
                review={reviewsById.get(tc.id)}
                decision={decisions[tc.id]}
                onToggleDecision={onToggleDecision}
              />
            ))}
          </tbody>
        </table>
      </div>

      {newCount > 0 && (
        <div className="border border-border bg-slate-900/20 p-4 rounded-md space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Đề xuất Test Case mới</span>
            <span className="bg-slate-800 text-slate-350 px-2 py-0.5 rounded text-[10px]">
              {newCount}
            </span>
          </div>
          <div className="grid gap-3">
            {review.newSuggestions.map((s, idx) => (
              <div className="flex gap-4 p-3 rounded-md bg-slate-950 border border-border" key={idx}>
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="rounded border-border bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    checked={!!newSuggestionDecisions[idx]}
                    onChange={e => onToggleSuggestion(idx, e.target.checked)}
                  />
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-semibold">{s.testCase.type}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-350 font-semibold">{s.testCase.priority}</span>
                    <strong className="text-xs text-slate-200">{s.testCase.name}</strong>
                  </div>
                  {s.reason && <div className="text-[10px] text-slate-400 leading-normal italic">{s.reason}</div>}
                  <div className="text-xs text-slate-300 bg-slate-900/40 p-2 rounded border border-border/30">{s.testCase.expectedResult}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
