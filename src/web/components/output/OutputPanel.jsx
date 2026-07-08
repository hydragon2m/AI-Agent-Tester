import React, { useEffect, useState } from 'react';
import { SKILLS } from '../../features/skills/skill-registry';
import { parseClarificationQuestions } from '../../features/skills/srs-clarification';
import { CodeOutput } from './CodeOutput';
import { MarkdownOutput } from './MarkdownOutput';
import { TestCaseReviewPanel } from './TestCaseReviewPanel';
import { TestCaseTable } from './TestCaseTable';
import { Button } from '../ui/Button';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

function ClarificationForm({ questions, onSubmit, loading }) {
  const [answers, setAnswers] = useState({});

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(answers);
  }

  return (
    <div className="border border-amber-500/30 bg-amber-500/5 p-4 rounded-md mb-4 animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] uppercase flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> CẦN BỔ SUNG THÔNG TIN
        </span>
      </div>
      <h3 className="text-sm font-semibold text-amber-500 mb-3">AI cần làm rõ các câu hỏi sau để hoàn thiện SRS:</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {questions.map((q, idx) => (
          <div key={idx} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {q.label}: <span className="font-normal text-slate-500">{q.text}</span>
            </label>
            <textarea
              className="w-full min-h-[60px] p-2 rounded-md border border-border bg-slate-950 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              placeholder="Nhập câu trả lời của bạn..."
              value={answers[q.label] || ''}
              onChange={e => setAnswers(prev => ({ ...prev, [q.label]: e.target.value }))}
              required
              disabled={loading}
            />
          </div>
        ))}
        <Button variant="outline" type="submit" disabled={loading} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
          {loading ? 'Đang sinh lại SRS...' : 'Cập nhật & Sinh lại SRS'}
        </Button>
      </form>
    </div>
  );
}

function SrsCompleteBanner({ signature }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [signature]);
  if (dismissed) return null;
  return (
    <div className="flex items-center justify-between gap-3 border border-emerald-500/20 bg-emerald-500/5 p-3 rounded-md mb-4 animate-in fade-in slide-in-from-top-4 duration-200">
      <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1.5">
        <CheckCircle className="w-4 h-4" />
        SRS đã hoàn chỉnh — không còn điểm cần làm rõ.
      </span>
      <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} className="h-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
        Ẩn
      </Button>
    </div>
  );
}

export function OutputPanel({ activeSkill, output, rawOutput, review, reviewDecisions, newSuggestionDecisions, onToggleDecision, onToggleSuggestion, onAcceptAllReview, onKeepAllReview, onApplyReview, onDismissReview, onSubmitClarifications, loading, onUpdateTestCases, nodePath }) {
  if (!output && !rawOutput) {
    if (activeSkill === 'testcase') {
      return (
        <TestCaseOutput
          result={{ testCases: [] }}
          rawOutput=""
          review={review}
          reviewDecisions={reviewDecisions}
          newSuggestionDecisions={newSuggestionDecisions}
          onToggleDecision={onToggleDecision}
          onToggleSuggestion={onToggleSuggestion}
          onAcceptAllReview={onAcceptAllReview}
          onKeepAllReview={onKeepAllReview}
          onApplyReview={onApplyReview}
          onDismissReview={onDismissReview}
          onUpdateTestCases={onUpdateTestCases}
          nodePath={nodePath}
        />
      );
    }
    return <div className="empty-state table-empty">Chưa có output.</div>;
  }
  if (activeSkill === 'testcase') {
    return (
      <TestCaseOutput
        result={output}
        rawOutput={rawOutput}
        review={review}
        reviewDecisions={reviewDecisions}
        newSuggestionDecisions={newSuggestionDecisions}
        onToggleDecision={onToggleDecision}
        onToggleSuggestion={onToggleSuggestion}
        onAcceptAllReview={onAcceptAllReview}
        onKeepAllReview={onKeepAllReview}
        onApplyReview={onApplyReview}
        onDismissReview={onDismissReview}
        onUpdateTestCases={onUpdateTestCases}
        nodePath={nodePath}
      />
    );
  }
  if (SKILLS[activeSkill].output === 'code') return <CodeOutput value={String(output || rawOutput)} />;

  const srsMarkdown = String(output || rawOutput || '');
  const questions = activeSkill === 'srs' ? parseClarificationQuestions(srsMarkdown) : [];

  return (
    <div className="output-sections">
      {questions.length > 0 && onSubmitClarifications && (
        <ClarificationForm
          key={questions.map(q => q.label).join('_')}
          questions={questions}
          onSubmit={onSubmitClarifications}
          loading={loading}
        />
      )}
      {activeSkill === 'srs' && questions.length === 0 && srsMarkdown.trim() && (
        <SrsCompleteBanner signature={srsMarkdown} />
      )}
      <MarkdownOutput value={srsMarkdown} />
    </div>
  );
}

function TestCaseOutput({ result, rawOutput, review, reviewDecisions, newSuggestionDecisions, onToggleDecision, onToggleSuggestion, onAcceptAllReview, onKeepAllReview, onApplyReview, onDismissReview, onUpdateTestCases, nodePath }) {
  if (!result?.testCases) return <CodeOutput value={rawOutput} />;
  const hasOverview = Boolean(result.summary) || result.assumptions?.length > 0 || result.openQuestions?.length > 0;

  return (
    <div className="output-sections space-y-4">
      {hasOverview && (
        <div className="border border-border bg-slate-900/50 p-4 rounded-md space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Overview
          </div>
          {result.summary && <p className="text-xs text-slate-350 leading-relaxed">{result.summary}</p>}
          {result.assumptions?.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Giả định (Assumptions)</div>
              <ul className="list-disc pl-4 text-xs text-slate-400 space-y-0.5">
                {result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
          {result.openQuestions?.length > 0 && (
            <div className="border border-amber-500/20 bg-amber-500/5 p-3 rounded space-y-1">
              <div className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Câu hỏi cần xác nhận từ AI
              </div>
              <ul className="list-disc pl-4 text-xs text-slate-400 space-y-0.5">
                {result.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      {review ? (
        <TestCaseReviewPanel
          testCases={result.testCases}
          review={review}
          decisions={reviewDecisions}
          newSuggestionDecisions={newSuggestionDecisions}
          onToggleDecision={onToggleDecision}
          onToggleSuggestion={onToggleSuggestion}
          onAcceptAll={onAcceptAllReview}
          onKeepAll={onKeepAllReview}
          onApply={onApplyReview}
          onDismiss={onDismissReview}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
            <span>Danh sách Test Case</span>
            <span className="bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded text-[10px]">
              {result.testCases.length}
            </span>
          </div>
          <TestCaseTable testCases={result.testCases} onUpdate={onUpdateTestCases} nodePath={nodePath} />
        </div>
      )}
    </div>
  );
}
