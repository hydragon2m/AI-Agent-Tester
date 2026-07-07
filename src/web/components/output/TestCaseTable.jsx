import React from 'react';

const TYPES = ['Positive', 'Negative', 'Boundary', 'Edge Case', 'Security', 'UI/UX'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const SUITES = ['Smoke', 'Regression', 'New Feature', 'Exploratory'];

export function TestCaseTable({ testCases, onUpdate }) {
  if (!testCases) return <div className="empty-state table-empty">Chưa có test case cho node hiện tại.</div>;

  function handleCellChange(idx, field, value) {
    const updated = [...testCases];
    if (field === 'steps') {
      // Split by newline and clean empty steps
      updated[idx] = {
        ...updated[idx],
        steps: typeof value === 'string' ? value.split('\n').filter(s => s.trim() !== '') : value
      };
    } else {
      updated[idx] = {
        ...updated[idx],
        [field]: value
      };
    }
    if (onUpdate) onUpdate(updated);
  }

  function handleAddRow() {
    const newRow = {
      id: '', // Empty ID: backend will auto-assign scoped module ID on save
      module: testCases[0]?.module || '',
      name: 'Test case mới',
      type: 'Positive',
      priority: 'Medium',
      suite: 'Regression',
      automationCandidate: 'Yes',
      traceTo: '',
      preconditions: '',
      steps: ['1. Bước đầu tiên'],
      testData: '',
      expectedResult: 'Kết quả mong đợi'
    };
    if (onUpdate) onUpdate([...testCases, newRow]);
  }

  function handleDeleteRow(idx) {
    if (!window.confirm('Xóa test case này?')) return;
    const updated = testCases.filter((_, i) => i !== idx);
    if (onUpdate) onUpdate(updated);
  }

  const inputStyle = {
    width: '100%',
    background: 'transparent',
    border: '1px solid transparent',
    color: 'var(--text-color, #fff)',
    padding: '4px 6px',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const textareaStyle = {
    ...inputStyle,
    minHeight: '60px',
    resize: 'vertical',
    fontFamily: 'inherit',
  };

  const selectStyle = {
    ...inputStyle,
    background: 'var(--panel-bg-alt, #222)',
    border: '1px solid var(--border-color, #444)',
    cursor: 'pointer',
  };

  return (
    <div className="tc-table-container">
      <div className="tc-table-wrapper">
        <table className="tc-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>TC ID</th>
              <th style={{ width: '100px' }}>Module</th>
              <th>Name</th>
              <th style={{ width: '110px' }}>Type</th>
              <th style={{ width: '100px' }}>Priority</th>
              <th style={{ width: '120px' }}>Suite</th>
              <th>Preconditions</th>
              <th>Steps (Mỗi bước 1 dòng)</th>
              <th>Expected</th>
              <th style={{ width: '50px', textAlign: 'center' }}>Xóa</th>
            </tr>
          </thead>
          <tbody>
            {testCases.map((tc, idx) => (
              <tr key={`${tc.id || 'new'}-${idx}`}>
                <td style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-color, #f0a000)' }}>
                  {tc.id || tc.externalId || '(Auto ID)'}
                </td>
                <td>
                  <input
                    type="text"
                    style={inputStyle}
                    className="editable-cell-input"
                    value={tc.module || ''}
                    onChange={e => handleCellChange(idx, 'module', e.target.value)}
                    placeholder="Module..."
                  />
                </td>
                <td>
                  <textarea
                    style={{ ...textareaStyle, minHeight: '40px' }}
                    className="editable-cell-input"
                    value={tc.name || ''}
                    onChange={e => handleCellChange(idx, 'name', e.target.value)}
                    placeholder="Tên test case..."
                  />
                </td>
                <td>
                  <select
                    style={selectStyle}
                    value={tc.type || 'Positive'}
                    onChange={e => handleCellChange(idx, 'type', e.target.value)}
                  >
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    style={selectStyle}
                    value={tc.priority || 'Medium'}
                    onChange={e => handleCellChange(idx, 'priority', e.target.value)}
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    style={selectStyle}
                    value={tc.suite || 'Regression'}
                    onChange={e => handleCellChange(idx, 'suite', e.target.value)}
                  >
                    {SUITES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <textarea
                    style={{ ...textareaStyle, minHeight: '40px' }}
                    className="editable-cell-input"
                    value={tc.preconditions || ''}
                    onChange={e => handleCellChange(idx, 'preconditions', e.target.value)}
                    placeholder="Điều kiện đầu..."
                  />
                </td>
                <td>
                  <textarea
                    style={textareaStyle}
                    className="editable-cell-input"
                    value={Array.isArray(tc.steps) ? tc.steps.join('\n') : String(tc.steps || '')}
                    onChange={e => handleCellChange(idx, 'steps', e.target.value)}
                    placeholder="Các bước thực hiện..."
                  />
                </td>
                <td>
                  <textarea
                    style={textareaStyle}
                    className="editable-cell-input"
                    value={tc.expectedResult || ''}
                    onChange={e => handleCellChange(idx, 'expectedResult', e.target.value)}
                    placeholder="Kết quả mong đợi..."
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    className="btn-danger-icon"
                    onClick={() => handleDeleteRow(idx)}
                    style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '16px' }}
                    title="Xóa dòng này"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-start' }}>
        <button type="button" className="btn-secondary" onClick={handleAddRow} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          ➕ Thêm Test Case mới
        </button>
      </div>
    </div>
  );
}
