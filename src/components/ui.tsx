import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="btn icon" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

/** Selector segmentado accesible (radio group) con botones grandes. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <label key={String(o.value)} className={`seg ${o.value === value ? 'on' : ''}`}>
            <input
              type="radio"
              name={name}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            <span className="seg-label">{o.label}</span>
            {o.hint && <span className="seg-hint">{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ServeBall({ title = 'Saca' }: { title?: string }) {
  return (
    <svg className="ball" viewBox="0 0 20 20" aria-label={title} role="img">
      <circle cx="10" cy="10" r="9" />
      <path d="M3.2 4.6c3 2.6 3 8.2 0 10.8M16.8 4.6c-3 2.6-3 8.2 0 10.8" />
    </svg>
  );
}
