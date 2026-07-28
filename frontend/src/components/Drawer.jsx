import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import IconButton from './IconButton';

export default function Drawer({ open, onClose, kicker, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-panel" role="dialog" aria-modal="true">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="text-label" style={{ color: 'var(--accent)' }}>
              {kicker}
            </div>
            <div className="mono" style={{ fontSize: 15, wordBreak: 'break-all', marginTop: 4 }}>
              {title}
            </div>
          </div>
          <IconButton size={32} onClick={onClose} aria-label="Close">
            <X size={16} />
          </IconButton>
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}
