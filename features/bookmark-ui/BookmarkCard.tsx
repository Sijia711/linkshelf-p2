import type { BookmarkRecord } from "./types";

type BookmarkCardProps = {
  bookmark: BookmarkRecord;
  isSelected: boolean;
  onToggleSelected: (id: string) => void;
  onEdit: (bookmark: BookmarkRecord) => void;
  onDelete: (bookmark: BookmarkRecord) => void;
};

/** One bookmark: selection checkbox, title, safe external link, tags, and actions. */
export function BookmarkCard({ bookmark, isSelected, onToggleSelected, onEdit, onDelete }: BookmarkCardProps) {
  const checkboxId = `bookmark-select-${bookmark.id}`;

  return (
    <article
      className={`flex h-full flex-col rounded-xl border bg-white p-5 ${
        isSelected ? "border-indigo-400 ring-1 ring-indigo-400" : "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelected(bookmark.id)}
          aria-label={`Select ${bookmark.title}`}
          className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-indigo-600"
        />
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 break-words">{bookmark.title}</h3>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-600 break-all hover:text-indigo-700 hover:underline"
          >
            {bookmark.url}
          </a>
        </div>
      </div>

      {bookmark.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
          {bookmark.tags.map((tag) => (
            <li key={tag} className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
              {tag}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex gap-2 pt-4">
        <button
          type="button"
          onClick={() => onEdit(bookmark)}
          aria-label={`Edit ${bookmark.title}`}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(bookmark)}
          aria-label={`Delete ${bookmark.title}`}
          className="rounded-lg border border-red-500 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Delete
        </button>
      </div>
    </article>
  );
}
