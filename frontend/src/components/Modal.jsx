import React, { useEffect, useId, useRef } from 'react';
export default function Modal({ title, children, onClose, busy = false, wide = false }) {
  const ref = useRef(null),
    titleId = useId();
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    ref.current.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="secondary"
          aria-label="Cerrar ventana"
          disabled={busy}
          onClick={onClose}
        >
          Cerrar ×
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
