type TagFilterProps = {
  tags: string[];
  /** `null` means "All". */
  activeTag: string | null;
  onChange: (tag: string | null) => void;
};

function chipClass(active: boolean): string {
  return `rounded-full border px-4 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
    active
      ? "border-indigo-600 bg-indigo-600 text-white"
      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
  }`;
}

/** Single-select tag chips; "All" clears the tag filter. */
export function TagFilter({ tags, activeTag, onChange }: TagFilterProps) {
  return (
    <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={activeTag === null}
        onClick={() => onChange(null)}
        className={chipClass(activeTag === null)}
      >
        All
      </button>
      {tags.map((tag) => {
        const active = activeTag !== null && activeTag.toLowerCase() === tag.toLowerCase();
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tag)}
            className={chipClass(active)}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
