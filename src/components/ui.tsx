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
            <Icon name="x" />
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
            <span className="seg-label">
              {o.value === value && <Icon name="check" className="seg-check" />}
              {o.label}
            </span>
            {o.hint && <span className="seg-hint">{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ServeBall({ title = 'Saca', decorative = false }: { title?: string; decorative?: boolean }) {
  const a11y = decorative ? { 'aria-hidden': true } : { 'aria-label': title, role: 'img' };
  return (
    <svg className="ball" viewBox="0 0 20 20" {...a11y}>
      <circle cx="10" cy="10" r="9" />
      <path d="M3.2 4.6c3 2.6 3 8.2 0 10.8M16.8 4.6c-3 2.6-3 8.2 0 10.8" />
    </svg>
  );
}

const ICONS = {
  back: <path d="M19 12H5m6-6-6 6 6 6" />,
  export: (
    <>
      <path d="M12 15V3m-4 4 4-4 4 4" />
      <path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4" />
      <path d="M5 15v5h14v-5" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5v1a3 3 0 0 0 3 3m8-4h3v1a3 3 0 0 1-3 3M12 13v4m-4 3h8m-6-3h4" />
    </>
  ),
  ace: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M7 17 17 7" />
    </>
  ),
  lines: <path d="M5 7h14M5 12h14M5 17h14" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  warning: (
    <>
      <path d="M12 4 2.5 20h19L12 4z" />
      <path d="M12 10v4.5m0 2.5v.01" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7m0 2.5v.01" />
    </>
  ),
  doubleFault: (
    <>
      <circle cx="8.5" cy="12" r="5.5" />
      <circle cx="15.5" cy="12" r="5.5" />
      <path d="M5 16 12 8m0 8 7-8" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M10 7V4h4v3m-8 0 1 13h10l1-13" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

/** Ícono lineal decorativo (el texto del botón lo acompaña). */
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
