import { useId, useRef, useState } from "react";
import { Dialog } from "./Dialog";

type DeleteConfirmDialogProps = {
  heading: string;
  message: string;
  confirmLabel: string;
  /** Shown when `onConfirm` rejects; the dialog stays open so the user can retry or cancel. */
  failureMessage: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

/** Confirmation for single and bulk deletion. Focus starts on Cancel. */
export function DeleteConfirmDialog({
  heading,
  message,
  confirmLabel,
  failureMessage,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const id = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError(failureMessage);
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }

  return (
    <Dialog
      labelledById={`${id}-heading`}
      onDismiss={onCancel}
      canDismiss={!isPending}
      initialFocusRef={cancelRef}
    >
      <h2 id={`${id}-heading`} className="mb-2 text-lg font-semibold text-gray-900">
        {heading}
      </h2>
      <p className="mb-5 text-sm text-gray-600">{message}</p>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {isPending ? "Deleting…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
