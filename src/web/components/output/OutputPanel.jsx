import React, { useState } from 'react';
import { SKILLS } from '../../features/skills/skill-registry';
import { CodeOutput } from './CodeOutput';
import { MarkdownOutput } from './MarkdownOutput';
import { TestCaseReviewPanel } from './TestCaseReviewPanel';
import { TestCaseTable } from './TestCaseTable';

function parseClarificationQuestions(markdownText) {
  if (typeof markdownText !== 'string') return [];
  const blockRegex = /(?:>|\s)*\*\*\[CÂU HỎI LÀM RÕ[^\]]+\]\*\*(?:\s*\n)([\s\S]*?)(?=\n\n|\n##|\n#|$)/i;
  const match = markdownText.match(blockRegex);
  if (!match) return [];
  
  const linesBlock = match[1];
  const questionRegex = /(?:>|\s)*-\s*(?:\*([^*]+)\*|([^*:\n]+))\s*:\s*([^\n]+)/g;
  const questions = [];
  let m;
  while ((m = questionRegex.exec(linesBlock)) !== null) {
    const label = m[1] || m[2] || 'Câu hỏi';
    const text = m[3];
    questions.push({ label: label.trim(), text: text.trim() });
  }
  return questions;
}

function ClarificationForm({ questions, onSubmit, loading }) {
  const [answers, setAnswers] = useState({});

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(answers);
  }

  return (
    <div className="clarification-panel" style={{ border: '1px solid #f0a000', background: 'rgba(240, 160, 0, 0.05)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <span className="step-badge" style={{ backgroundColor: '#f0a000', color: '#000', fontWeight: 'bold' }}>⚠️ CẦN BỔ SUNG THÔNG TIN</span>
        <h3 style={{ margin: '8px 0 4px 0', fontSize: 15, color: '#f0a000' }}>AI cần làm rõ các câu hỏi sau để hoàn thiện SRS:</h3>
      </div>
      <form onSubmit={handleSubmit}>
        {questions.map((q, idx) => (
          <div key={idx} className="form-group" style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
              {q.label}: <span style={{ fontWeight: 400, color: 'var(--text-muted, #aaa)' }}>{q.text}</span>
            </label>
            <textarea
              className="pf-textarea"
              style={{ width: '100%', minHeight: '60px', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color, #444)', fontSize: '13px', background: 'var(--input-bg, #222)', color: 'var(--text-color, #fff)' }}
              placeholder="Nhập câu trả lời của bạn..."
              value={answers[q.label] || ''}
              onChange={e => setAnswers(prev => ({ ...prev, [q.label]: e.target.value }))}
              required
              disabled={loading}
            />
          </div>
        ))}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Đang sinh lại SRS...' : 'Cập nhật & Sinh lại SRS'}
        </button>
      </form>
    </div>
  );
}

export function OutputPanel({ activeSkill, output, rawOutput, review, reviewDecisions, newSuggestionDecisions, onToggleDecision, onToggleSuggestion, onAcceptAllReview, onKeepAllReview, onApplyReview, onDismissReview, onSubmitClarifications, loading }) {
  if (!output && !rawOutput) return <div className="empty-state table-empty">Chưa có output.</div>;
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
      <MarkdownOutput value={srsMarkdown} />
    </div>
  );
}

function TestCaseOutput({ result, rawOutput, review, reviewDecisions, newSuggestionDecisions, onToggleDecision, onToggleSuggestion, onAcceptAllReview, onKeepAllReview, onApplyReview, onDismissReview }) {
  if (!result?.testCases) return <CodeOutput value={rawOutput} />;
  const hasOverview = Boolean(result.summary) || result.assumptions?.length > 0 || result.openQuestions?.length > 0;

  return (
    <div className="output-sections">
      {hasOverview && (
        <div className="output-overview">
          <div className="output-overview-title">Overview</div>
          {result.summary && <p className="summary-text">{result.summary}</p>}
          {result.assumptions?.length > 0 && (
            <div className="overview-block">
              <div className="overview-block-label">Giả định (Assumptions)</div>
              <ul>{result.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {result.openQuestions?.length > 0 && (
            <div className="overview-block overview-block-warning">
              <div className="overview-block-label">⚠ Câu hỏi cần xác nhận từ AI</div>
              <ul>{result.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
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
        <div className="output-list-section">
          <div className="output-list-header">
            <span>Danh sách Test Case</span>
            <span className="output-count-badge">{result.testCases.length}</span>
          </div>
          <TestCaseTable testCases={result.testCases} />
        </div>
      )}
    </div>
  );
}
