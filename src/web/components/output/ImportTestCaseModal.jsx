import { useState } from 'react';
import { Button } from '../ui/Button';
import { X, ClipboardPaste } from 'lucide-react';

// Dán bảng test case copy từ Excel / Google Sheets / Lark grid / CSV → lưu thẳng
// DB (0 token, KHÔNG gọi AI). Cột nhận diện theo tiêu đề (khớp bộ cột export),
// hoặc theo thứ tự cột cố định nếu không có dòng tiêu đề.
export function ImportTestCaseModal({ onClose, onImport, busy }) {
  const [text, setText] = useState('');

  return (
    <div className="modal-overlay flex items-center justify-center fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm p-4">
      <div className="modal modal-wide w-full max-w-2xl bg-slate-900 border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="modal-header flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ClipboardPaste className="w-4 h-4" /> Import Test Case (0 token)
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-white rounded-md">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="modal-body p-5 space-y-3">
          <div className="text-xs text-slate-400 leading-normal space-y-1">
            <div>Copy vùng bảng test case từ <strong className="text-slate-200">Excel / Google Sheets / Lark</strong> rồi dán vào đây. Lưu thẳng vào node đang chọn, <strong className="text-indigo-400">không tốn token AI</strong>.</div>
            <div>Nên có dòng tiêu đề khớp cột export: <span className="text-slate-300">TC ID, Module, Screen, Feature, Test Case Name, Type, Priority, Suite, Preconditions, Steps, Expected Result, Test Data, Status...</span> Cột <strong>Steps</strong> mỗi bước 1 dòng. (Screen/Feature lấy theo vị trí node trong cây.)</div>
          </div>
          <textarea
            className="w-full min-h-[220px] p-3 rounded-md border border-border bg-slate-950 text-slate-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={'Dán bảng ở đây (Ctrl+V)...\nVí dụ:\nTC ID\tModule\tTest Case Name\tType\tPriority\tSteps\tExpected Result\nPRD-001\tProducts\tHiển thị danh sách\tPositive\tHigh\t1. Mở màn hình\nHệ thống hiển thị đủ cột'}
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
            disabled={busy}
          />
          <div className="modal-actions flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Huỷ</Button>
            <Button variant="default" size="sm" onClick={() => onImport(text)} disabled={!text.trim() || busy}>
              {busy ? 'Đang import...' : 'Import & lưu'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
