"use client";

import React from "react";
import type { LearningPathItem } from "@/types/learning-path";
import { extractDomain } from "@/lib/learning-paths";

interface Props {
  item: LearningPathItem;
  index?: number;
  isFirst?: boolean;
  isLast?: boolean;
  onToggle: (itemId: string, completed: boolean) => Promise<void>;
  onMove: (itemId: string, direction: "up" | "down") => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}

export default function LearningPathItemCard({
  item,
  index = item.position,
  isFirst = item.position === 0,
  isLast = false,
  onToggle,
  onMove,
  onDelete,
}: Props) {
  const { id, is_completed, bookmark } = item;
  const domain = bookmark?.url ? extractDomain(bookmark.url) : null;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onToggle(id, !is_completed);
  };

  const handleMove = async (e: React.MouseEvent, dir: "up" | "down") => {
    e.stopPropagation();
    await onMove(id, dir);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Remove this item from the learning path?")) {
      await onDelete(id);
    }
  };

  return (
    <div
      className={`border rounded-lg p-3.5 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
        is_completed ? "bg-gray-50 border-gray-200" : "bg-white border-gray-300 shadow-sm"
      }`}
      data-testid="learning-path-item"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 mt-0.5 ${
            is_completed
              ? "bg-green-100 text-green-800"
              : "bg-indigo-100 text-indigo-700"
          }`}
          aria-label={`Step ${index + 1}`}
        >
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          {bookmark ? (
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`font-medium hover:underline text-base break-words ${
                    is_completed ? "text-gray-600 line-through" : "text-blue-700 hover:text-blue-900"
                  }`}
                  data-testid="resource-title-link"
                >
                  {bookmark.title}
                </a>
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 shrink-0 font-medium"
                  data-testid="open-resource-link"
                  aria-label={`Open original resource: ${bookmark.title}`}
                >
                  Open Resource ↗
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                {domain && (
                  <span className="font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                    {domain}
                  </span>
                )}
                <span className="truncate max-w-xs text-gray-400" title={bookmark.url}>
                  {bookmark.url}
                </span>
                {bookmark.tags && bookmark.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {bookmark.tags.map((t) => (
                      <span key={t} className="text-gray-500 bg-gray-100 px-1 rounded text-[11px]">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <span className="text-gray-400 italic text-sm">(Resource bookmark is unavailable or deleted)</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        <button
          type="button"
          onClick={handleToggle}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition cursor-pointer ${
            is_completed
              ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
          }`}
          data-testid="toggle-completion-button"
          aria-label={is_completed ? `Mark ${bookmark?.title ?? "item"} incomplete` : `Mark ${bookmark?.title ?? "item"} complete`}
        >
          {is_completed ? "Done" : "Mark"}
        </button>

        <button
          type="button"
          onClick={(e) => handleMove(e, "up")}
          disabled={isFirst}
          className="px-2 py-1 text-xs font-bold rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Move item up"
          title="Move up"
        >
          ↑
        </button>

        <button
          type="button"
          onClick={(e) => handleMove(e, "down")}
          disabled={isLast}
          className="px-2 py-1 text-xs font-bold rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Move item down"
          title="Move down"
        >
          ↓
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="px-2 py-1 text-xs font-bold rounded-md border border-red-200 text-red-600 bg-white hover:bg-red-50 transition cursor-pointer"
          aria-label="Remove item"
          title="Remove from path"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
