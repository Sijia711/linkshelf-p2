import { useId, useRef, useState, type FormEvent } from "react";
import { Dialog } from "./Dialog";
import type { BookmarkInput } from "./types";
import { validateBookmarkForm, type BookmarkFormErrors, type BookmarkFormValues } from "./validation";

type BookmarkFormModalProps = {
  mode: "create" | "edit";
  initialValues: BookmarkFormValues;
  /** Resolves when the parent accepted the change; rejects on failure. */
  onSubmit: (input: BookmarkInput) => Promise<void>;
  onCancel: () => void;
};

export const SAVE_ERROR_MESSAGE = "Could not save bookmark. Please try again.";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

/** Shared Add / Edit bookmark dialog with inline validation. */
export function BookmarkFormModal({ mode, initialValues, onSubmit, onCancel }: BookmarkFormModalProps) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const [values, setValues] = useState<BookmarkFormValues>(initialValues);
  const [errors, setErrors] = useState<BookmarkFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const heading = mode === "create" ? "Add Bookmark" : "Edit Bookmark";

  function update(field: keyof BookmarkFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const result = validateBookmarkForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      (result.errors.title ? titleRef : urlRef).current?.focus();
      return;
    }

    setErrors({});
    setSubmitError(null);
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onSubmit(result.input);
    } catch {
      setSubmitError(SAVE_ERROR_MESSAGE);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      labelledById={`${id}-heading`}
      onDismiss={onCancel}
      canDismiss={!isSubmitting}
      initialFocusRef={titleRef}
    >
      <form noValidate onSubmit={handleSubmit}>
        <h2 id={`${id}-heading`} className="mb-5 text-lg font-semibold text-gray-900">
          {heading}
        </h2>

        <div className="mb-4">
          <label htmlFor={`${id}-title`} className="mb-1 block text-sm text-gray-600">
            Title
          </label>
          <input
            ref={titleRef}
            id={`${id}-title`}
            type="text"
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. MDN Web Docs"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${id}-title-error` : undefined}
            className={`${inputClass} ${errors.title ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.title && (
            <p id={`${id}-title-error`} className="mt-1 text-sm text-red-600">
              {errors.title}
            </p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor={`${id}-url`} className="mb-1 block text-sm text-gray-600">
            URL
          </label>
          <input
            ref={urlRef}
            id={`${id}-url`}
            type="url"
            inputMode="url"
            value={values.url}
            onChange={(e) => update("url", e.target.value)}
            placeholder="https://example.com"
            aria-invalid={errors.url ? true : undefined}
            aria-describedby={errors.url ? `${id}-url-error` : undefined}
            className={`${inputClass} ${errors.url ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.url && (
            <p id={`${id}-url-error`} className="mt-1 text-sm text-red-600">
              {errors.url}
            </p>
          )}
        </div>

        <div className="mb-6">
          <label htmlFor={`${id}-tags`} className="mb-1 block text-sm text-gray-600">
            Tags <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id={`${id}-tags`}
            type="text"
            value={values.tagsText}
            onChange={(e) => update("tagsText", e.target.value)}
            placeholder="dev, reference"
            aria-describedby={`${id}-tags-hint`}
            className={`${inputClass} border-gray-300`}
          />
          <p id={`${id}-tags-hint`} className="mt-1 text-xs text-gray-500">
            Separate tags with commas. Clear a tag from the list to remove it.
          </p>
        </div>

        {submitError && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
