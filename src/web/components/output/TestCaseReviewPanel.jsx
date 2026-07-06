const FIELD_LABELS = {
  name: 'Name',
  type: 'Type',
  priority: 'Priority',
  preconditions: 'Preconditions',
  steps: 'Steps',
  expectedResult: 'Expected',
  testData: 'Test Data',
};

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

const ROW_ORDER = { modify: 0, delete: 0, keep: 1 };

function ReviewRow({ tc, review, decision, onToggleDecision }) {
  const action = review?.action || 'keep';
  const changes = changedFieldsMap(review?.changes);
  const rowClass = action === 'delete' ? 'tc-review-row-delete' : action === 'modify' ? 'tc-review-row-modify' : '';

  function renderCell(field, plainValue) {
    const change = changes.get(field);
    if (action === 'modify' && change) {
      return (
        <td className="tc-diff-cell">
          <div className="diff-old">{formatFieldValue(field, change.oldValue)}</div>
          <div className="diff-new">{formatFieldValue(field, change.newValue)}</div>
        </td>
      );
    }
    return <td>{formatFieldValue(field, plainValue)}</td>;
  }

  return (
    <tr className={rowClass}>
      <td>{tc.id}</td>
      <td>{tc.module || '-'}</td>
      {renderCell('name', tc.name)}
      {renderCell('type', <span className={`tc-badge type-${String(tc.type || '').toLowerCase().replace(/\W+/g, '-')}`}>{tc.type}</span>)}
      {renderCell('priority', <span className={`tc-badge prio-${String(tc.priority || '').toLowerCase()}`}>{tc.priority}</span>)}
      {renderCell('preconditions', tc.preconditions)}
      {renderCell('steps', tc.steps || [])}
      {renderCell('expectedResult', tc.expectedResult)}
      <td className="tc-review-action-cell">
        {action === 'modify' && (
          <label className="tc-review-checkbox">
            <input
              type="checkbox"
              checked={decision === 'apply'}
              onChange={e => onToggleDecision(tc.id, e.target.checked ? 'apply' : 'keep')}
            />
            Áp dụng sửa
          </label>
        )}
        {action === 'delete' && (
          <label className="tc-review-checkbox">
            <input
              type="checkbox"
              checked={decision === 'remove'}
              onChange={e => onToggleDecision(tc.id, e.target.checked ? 'remove' : 'keep')}
            />
            Xoá case này
          </label>
        )}
        {action === 'keep' && <span className="tc-badge tc-badge-ok">✓ Đạt</span>}
        {review?.reason && <div className="tc-review-reason">{review.reason}</div>}
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
    <div className="tc-review-panel">
      <div className="tc-review-toolbar">
        <div className="tc-review-summary">
          {review.summary && <p>{review.summary}</p>}
          <span className="tc-review-counts">
            {modifyCount} đề xuất sửa · {deleteCount} đề xuất xoá · {newCount} case mới
          </span>
        </div>
        <div className="tc-review-toolbar-actions">
          <button className="btn-secondary" onClick={onAcceptAll}>Áp dụng tất cả đề xuất</button>
          <button className="btn-secondary" onClick={onKeepAll}>Giữ nguyên tất cả</button>
          <button className="btn-secondary" onClick={onDismiss}>Bỏ qua đánh giá</button>
          <button className="btn-primary" onClick={onApply}>Áp dụng lựa chọn</button>
        </div>
      </div>

      <div className="tc-table-wrapper">
        <table className="tc-table">
          <thead>
            <tr>
              <th>TC ID</th>
              <th>Module</th>
              <th>Name</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Preconditions</th>
              <th>Steps</th>
              <th>Expected</th>
              <th>Đề xuất</th>
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
        <div className="tc-review-suggestions">
          <div className="output-list-header">
            <span>Đề xuất Test Case mới</span>
            <span className="output-count-badge">{newCount}</span>
          </div>
          {review.newSuggestions.map((s, idx) => (
            <div className="tc-review-suggestion-row" key={idx}>
              <label className="tc-review-checkbox">
                <input
                  type="checkbox"
                  checked={!!newSuggestionDecisions[idx]}
                  onChange={e => onToggleSuggestion(idx, e.target.checked)}
                />
                Thêm case này
              </label>
              <div className="tc-review-suggestion-body">
                <div>
                  <span className={`tc-badge type-${String(s.testCase.type || '').toLowerCase().replace(/\W+/g, '-')}`}>{s.testCase.type}</span>{' '}
                  <span className={`tc-badge prio-${String(s.testCase.priority || '').toLowerCase()}`}>{s.testCase.priority}</span>{' '}
                  <strong>{s.testCase.name}</strong>
                </div>
                <div className="tc-review-reason">{s.reason}</div>
                <div>{s.testCase.expectedResult}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
