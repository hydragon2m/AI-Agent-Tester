import React, { useState, useRef } from 'react';
import { sortTestCases } from '../../features/testcase/testcase-quality';
import { Select } from '../ui/Select';
import { Trash2, Plus } from 'lucide-react';

const TYPES = ['Positive', 'Negative', 'Boundary', 'Edge Case', 'Security', 'UI/UX'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const SUITES = ['Smoke', 'Regression', 'New Feature', 'Exploratory'];
const STATUSES = ['', 'Pass', 'Fail', 'Pending', 'Block', 'Untest'];
const PAGE_SIZE = 20; // số test case mỗi trang

// Cột bảng TC (thứ tự khớp đúng với <td> trong tbody) + độ rộng mặc định (px).
// `del` (nút Xóa) cố định, không cho kéo giãn.
const COLUMNS = [
  { key: 'id', label: 'TC ID', width: 80 },
  { key: 'module', label: 'Module', width: 110 },
  { key: 'screen', label: 'Screen', width: 110 },
  { key: 'feature', label: 'Feature', width: 110 },
  { key: 'name', label: 'Name', width: 200 },
  { key: 'type', label: 'Type', width: 110 },
  { key: 'priority', label: 'Priority', width: 100 },
  { key: 'suite', label: 'Suite', width: 120 },
  { key: 'preconditions', label: 'Preconditions', width: 180 },
  { key: 'steps', label: 'Steps (Mỗi bước 1 dòng)', width: 240 },
  { key: 'expected', label: 'Expected', width: 220 },
  { key: 'status', label: 'Status', width: 110 },
  { key: 'del', label: 'Xóa', width: 50, fixed: true },
];
const DEFAULT_COL_WIDTHS = Object.fromEntries(COLUMNS.map(c => [c.key, c.width]));

function getNextTestCaseId(existingCases, nodePathModule) {
  let prefix = 'TC';
  let maxNum = 0;
  
  const idPattern = /^([a-zA-Z]+)-(\d+)$/;
  existingCases.forEach(tc => {
    if (tc.id) {
      const m = idPattern.exec(tc.id);
      if (m) {
        prefix = m[1].toUpperCase();
        maxNum = Math.max(maxNum, parseInt(m[2], 10));
      }
    }
  });

  if (maxNum === 0) {
    const letters = String(nodePathModule || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase();
    prefix = letters || 'TC';
  }

  const existingIds = new Set(existingCases.map(tc => tc.id).filter(Boolean));
  let counter = maxNum + 1;
  let candidate;
  do {
    candidate = `${prefix}-${String(counter).padStart(3, '0')}`;
    counter++;
  } while (existingIds.has(candidate));

  return candidate;
}

// nodePath = { module, screen, feature } lấy từ cây (context của node đang chọn) — cùng
// nguồn với dữ liệu đẩy lên Lark / export, hiển thị read-only để bảng "đầy đủ" cột.
export function TestCaseTable({ testCases, onUpdate, nodePath = {} }) {
  const [colWidths, setColWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('hydra-tc-col-widths');
      return saved ? JSON.parse(saved) : DEFAULT_COL_WIDTHS;
    } catch {
      return DEFAULT_COL_WIDTHS;
    }
  });
  const [page, setPage] = useState(0);
  const dragRef = useRef(null); // { key, startX, startW }
  const wrapperRef = useRef(null);

  function startResize(e, key) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { key, startX: e.clientX, startW: colWidths[key] };
    const move = ev => {
      const d = dragRef.current;
      if (!d) return;
      const next = Math.max(60, d.startW + (ev.clientX - d.startX));
      setColWidths(prev => {
        const updated = { ...prev, [d.key]: next };
        try {
          localStorage.setItem('hydra-tc-col-widths', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  const tableWidth = COLUMNS.reduce((sum, c) => sum + (colWidths[c.key] || c.width), 0);

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
    const nextId = getNextTestCaseId(testCases, nodePath.module);
    const newRow = {
      id: nextId,
      module: testCases[0]?.module || nodePath.module || '',
      name: 'Test case mới',
      type: 'Positive',
      priority: 'Medium',
      suite: 'Regression',
      automationCandidate: 'Yes',
      traceTo: '',
      preconditions: '',
      steps: ['1. Bước đầu tiên'],
      testData: '',
      expectedResult: 'Kết quả mong đợi',
      status: ''
    };
    const nextList = sortTestCases([...testCases, newRow]);
    const idx = nextList.indexOf(newRow);
    if (onUpdate) onUpdate(nextList);
    setPage(Math.floor(idx / PAGE_SIZE)); // nhảy tới trang chứa TC vừa thêm
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
    resize: 'none', // Locked vertical resizing to prevent layout breaking
    fontFamily: 'inherit',
  };

  // Cell context read-only (Module/Screen/Feature từ cây): hiện gọn + hover xem full.
  const contextCellStyle = {
    fontSize: '12px', color: 'var(--text-secondary, #94a3b8)',
    display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };

  // Phân trang: currentPage được clamp để không lệ thuộc state cũ (khi đổi node / xóa bớt TC).
  const totalPages = Math.max(1, Math.ceil(testCases.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * PAGE_SIZE;
  const pageRows = testCases.slice(pageStart, pageStart + PAGE_SIZE);
  function goToPage(p) {
    setPage(Math.min(Math.max(0, p), totalPages - 1));
    if (wrapperRef.current) wrapperRef.current.scrollTop = 0; // về đầu trang mới
  }

  return (
    <div className="tc-table-container">
      <div className="tc-table-wrapper" ref={wrapperRef}>
        <table className="tc-table" style={{ tableLayout: 'fixed', width: tableWidth }}>
          <thead>
            <tr>
              {COLUMNS.map(c => (
                <th
                  key={c.key}
                  style={{ width: colWidths[c.key], position: 'relative', textAlign: c.key === 'del' ? 'center' : 'left' }}
                >
                  {c.label}
                  {!c.fixed && (
                    <span
                      className="col-resize-handle"
                      onMouseDown={e => startResize(e, c.key)}
                      title="Kéo để chỉnh độ rộng cột"
                      style={{ position: 'absolute', top: 0, right: 0, width: 6, height: '100%', cursor: 'col-resize' }}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Chưa có test case nào cho node này. Nhấn nút bên dưới để thêm mới thủ công.
                </td>
              </tr>
            ) : (
              pageRows.map((tc, i) => { const idx = pageStart + i; return (
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
                      title={tc.module || ''}
                      onChange={e => handleCellChange(idx, 'module', e.target.value)}
                      placeholder="Module..."
                    />
                  </td>
                  <td>
                    <span style={contextCellStyle} title={nodePath.screen || '—'}>{nodePath.screen || '—'}</span>
                  </td>
                  <td>
                    <span style={contextCellStyle} title={nodePath.feature || '—'}>{nodePath.feature || '—'}</span>
                  </td>
                  <td>
                    <textarea
                      style={{ ...textareaStyle, minHeight: '40px' }}
                      className="editable-cell-input"
                      value={tc.name || ''}
                      title={tc.name || ''}
                      onChange={e => handleCellChange(idx, 'name', e.target.value)}
                      placeholder="Tên test case..."
                    />
                  </td>
                  <td>
                    <Select
                      value={tc.type || 'Positive'}
                      onChange={e => handleCellChange(idx, 'type', e.target.value)}
                    >
                      {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </td>
                  <td>
                    <Select
                      value={tc.priority || 'Medium'}
                      onChange={e => handleCellChange(idx, 'priority', e.target.value)}
                    >
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </Select>
                  </td>
                  <td>
                    <Select
                      value={tc.suite || 'Regression'}
                      onChange={e => handleCellChange(idx, 'suite', e.target.value)}
                    >
                      {SUITES.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </td>
                  <td>
                    <textarea
                      style={{ ...textareaStyle, minHeight: '40px' }}
                      className="editable-cell-input"
                      value={tc.preconditions || ''}
                      title={tc.preconditions || ''}
                      onChange={e => handleCellChange(idx, 'preconditions', e.target.value)}
                      placeholder="Điều kiện đầu..."
                    />
                  </td>
                  <td>
                    <textarea
                      style={textareaStyle}
                      className="editable-cell-input"
                      value={Array.isArray(tc.steps) ? tc.steps.join('\n') : String(tc.steps || '')}
                      title={Array.isArray(tc.steps) ? tc.steps.join('\n') : String(tc.steps || '')}
                      onChange={e => handleCellChange(idx, 'steps', e.target.value)}
                      placeholder="Các bước thực hiện..."
                    />
                  </td>
                  <td>
                    <textarea
                      style={textareaStyle}
                      className="editable-cell-input"
                      value={tc.expectedResult || ''}
                      title={tc.expectedResult || ''}
                      onChange={e => handleCellChange(idx, 'expectedResult', e.target.value)}
                      placeholder="Kết quả mong đợi..."
                    />
                  </td>
                  <td>
                    <Select
                      value={tc.status || ''}
                      onChange={e => handleCellChange(idx, 'status', e.target.value)}
                      title="Trạng thái chạy test (đồng bộ với Lark + Release Check)"
                    >
                      {STATUSES.map(s => <option key={s || 'none'} value={s}>{s || '—'}</option>)}
                    </Select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="flex items-center justify-center mx-auto text-red-500 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors"
                      onClick={() => handleDeleteRow(idx)}
                      title="Xóa dòng này"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </td>
                </tr>
              ); })
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={handleAddRow} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus className="w-4 h-4 text-indigo-400" /> Thêm Test Case mới
        </button>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <button type="button" className="btn-secondary" disabled={currentPage === 0} onClick={() => goToPage(currentPage - 1)}>‹ Trước</button>
            <span style={{ opacity: 0.85, whiteSpace: 'nowrap' }}>Trang {currentPage + 1}/{totalPages} · {testCases.length} TC</span>
            <button type="button" className="btn-secondary" disabled={currentPage >= totalPages - 1} onClick={() => goToPage(currentPage + 1)}>Sau ›</button>
          </div>
        )}
      </div>
    </div>
  );
}
