import { SKILLS } from '../../features/skills/skill-registry';
import { CodeOutput } from './CodeOutput';
import { MarkdownOutput } from './MarkdownOutput';
import { TestCaseReviewPanel } from './TestCaseReviewPanel';
import { TestCaseTable } from './TestCaseTable';

export function OutputPanel({ activeSkill, output, rawOutput, review, reviewDecisions, newSuggestionDecisions, onToggleDecision, onToggleSuggestion, onAcceptAllReview, onKeepAllReview, onApplyReview, onDismissReview }) {
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
  return <MarkdownOutput value={output || rawOutput} />;
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
