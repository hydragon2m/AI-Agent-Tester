import { DropdownMenu, DropdownMenuItem } from '../ui/DropdownMenu';
import { RotateCcw, Edit2, Trash2, MoreHorizontal } from 'lucide-react';

export function HistoryItem({ item, active, onView, onRename, onDelete, onRestore }) {
  return (
    <div className={`history-item-row flex items-center justify-between p-1 rounded-md transition-colors ${active ? 'bg-indigo-600/10 border border-indigo-500/30' : 'bg-slate-900/40 border border-transparent hover:border-slate-800'}`}>
      <button
        className="history-item flex-1 text-left px-2 py-1 min-w-0"
        title={`${item.title || item.input || 'Không có tiêu đề'} — ${new Date(item.createdAt).toLocaleString('vi-VN')}`}
        onClick={() => onView(item)}
      >
        <span className="block text-slate-200 font-medium text-xs truncate">{item.title || item.input || '(Không có tiêu đề)'}</span>
        <span className="block text-slate-500 text-[0.65rem] mt-0.5">{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
      </button>
      <div className="flex items-center px-1">
        <DropdownMenu 
          align="right"
          trigger={
            <button
              type="button"
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title="Chức năng"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          }
        >
          <DropdownMenuItem onClick={() => onRestore(item)}>
            <RotateCcw className="w-4 h-4 mr-2 text-indigo-400" />
            Reset về bản này
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRename(item)}>
            <Edit2 className="w-4 h-4 mr-2 text-amber-400" />
            Đổi tên
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(item)} destructive>
            <Trash2 className="w-4 h-4 mr-2" />
            Xóa
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </div>
  );
}
