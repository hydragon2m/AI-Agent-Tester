import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Loader2 } from 'lucide-react';
import {
  Dialog, DialogClose, DialogHeader, DialogIcon,
  DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogField,
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { cn } from '../../utils/utils';

/**
 * Modal tạo mới / chỉnh sửa System — dùng shadcn-style Dialog.
 * Props:
 *   mode         : 'create' | 'edit'
 *   initialData  : { name?, description? }
 *   onConfirm(payload): async fn xử lý API
 *   onClose()    : đóng modal
 */
export function SystemFormModal({ mode = 'create', initialData = {}, onConfirm, onClose }) {
  const [name, setName] = useState(initialData.name || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);
  const isEdit = mode === 'edit';

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Tên hệ thống không được để trống.'); return; }
    setLoading(true);
    setError('');
    try {
      await onConfirm({ name: name.trim(), description: description.trim() });
      onClose();
    } catch (err) {
      setError(err?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog isOpen onClose={onClose} className="max-w-md">
      <DialogClose onClose={onClose} />

      <DialogHeader>
        <DialogIcon className="bg-indigo-500/10 border border-indigo-500/20">
          <FolderOpen className="w-4.5 h-4.5 text-indigo-400" />
        </DialogIcon>
        <div>
          <DialogTitle>
            {isEdit ? 'Chỉnh sửa hệ thống' : 'Tạo hệ thống mới'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Cập nhật tên và mô tả cho hệ thống này'
              : 'Hệ thống là nhóm chứa các Project liên quan'}
          </DialogDescription>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogBody>
          {/* Tên */}
          <DialogField label="Tên hệ thống" required>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="VD: GIGAGO, INVENTORY, CRM..."
              className={cn(
                'w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-slate-100',
                'placeholder-zinc-600 outline-none transition-all',
                error
                  ? 'border-red-500/60 focus:ring-1 focus:ring-red-500/40'
                  : 'border-zinc-800 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30',
              )}
            />
            {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
          </DialogField>

          {/* Mô tả */}
          <DialogField label="Mô tả" >
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về hệ thống này... (tùy chọn)"
              rows={3}
              className={cn(
                'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-slate-100',
                'placeholder-zinc-600 outline-none transition-all resize-none',
                'focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30',
              )}
            />
          </DialogField>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 h-9 border-zinc-800 hover:bg-zinc-800 hover:text-white text-xs"
            onClick={onClose}
            disabled={loading}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            size="sm"
            className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            disabled={loading || !name.trim()}
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Đang lưu...</>
              : isEdit ? 'Lưu thay đổi' : 'Tạo hệ thống'
            }
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
