import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DialogProps = {
  labelledById: string;
  /** Called on Escape or backdrop click, only when `canDismiss` is true. */
  onDismiss: () => void;
  canDismiss: boolean;
  /** Element to focus when the dialog opens; defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

/**
 * Minimal accessible modal shell shared by the form and confirmation dialogs:
 * role="dialog", aria-modal, initial focus, Tab focus trap, Escape to close,
 * and focus returned to the previously focused element on close.
 */
export function Dialog({ labelledById, onDismiss, canDismiss, initialFocusRef, children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target =
      initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? null;
    target?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, [initialFocusRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (canDismiss) onDismiss();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;

    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && canDismiss) onDismiss();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}
