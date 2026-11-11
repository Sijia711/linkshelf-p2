"use client";

import React, { useState } from "react";
import type { LearningPathItem } from "@/types/learning-path";
import { extractDomain, getResourceStatusLabel } from "@/lib/learning-paths";

interface Props {
  item: LearningPathItem;
  index?: number;
  isFirst?: boolean;
  isLast?: boolean;
  onUpdateProgress?: (itemId: string, progress: number) => Promise<void>;
  onToggle?: (itemId: string, completed: boolean) => Promise<void>;
  onMove: (itemId: string, direction: "up" | "down") => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}

export default function LearningPathItemCard({
  item,
  index = item.position,
  isFirst = item.position === 0,
  isLast = false,
  onUpdateProgress,
  onToggle,
  onMove,
  onDelete,
}: Props) {
  const { id, is_completed, bookmark } = item;
  const currentProgress =
    typeof item.progress_percentage === "number"
      ? item.progress_percentage
      : is_completed
      ? 100
      : 0;

  const [prevProgress, setPrevProgress] = useState(currentProgress);
  const [inputValue, setInputValue] = useState(String(currentProgress));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentProgress !== prevProgress) {
    setPrevProgress(currentProgress);
    setInputValue(String(currentProgress));
    setError(null);
  }

  const domain = bookmark?.url ? extractDomain(bookmark.url) : null;
  const isCompleted = currentProgress >= 100;
  const statusLabel = getResourceStatusLabel(currentProgress);

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!inputValue || inputValue.trim() === "") {
      setError("Please enter a progress percentage between 0 and 100.");
      return;
    }

    const num = Number(inputValue);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      setError("Please enter a valid numeric progress percentage.");
      return;
    }

    if (num < 0 || num > 100) {
      setError("Progress percentage must be between 0 and 100.");
      return;
    }

    // Decimal input within range truncated toward zero (e.g. 20.78 -> 20)
    const truncated = Math.trunc(num);
    setInputValue(String(truncated));
    setError(null);
    setIsSaving(true);

    try {
      if (onUpdateProgress) {
        await onUpdateProgress(id, truncated);
      } else if (onToggle) {
        await onToggle(id, truncated === 100);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update progress.");
    } finally {
      setIsSaving(false);
    }
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
      className={`border rounded-lg p-4 mb-3 transition ${
        isCompleted ? "bg-gray-50 border-gray-200" : "bg-white border-gray-300 shadow-sm"
      }`}
      data-testid="learning-path-item"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 mt-0.5 ${
              isCompleted
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
                      isCompleted ? "text-gray-600 line-through" : "text-blue-700 hover:text-blue-900"
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

        {/* Action Controls: Move & Remove */}
        <div className="flex items-center gap-1.5 shrink-0">
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

      {/* Progress Editor & Progress Bar */}
      <div className="mt-3 pt-2.5 border-t border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                currentProgress >= 100
                  ? "bg-green-100 text-green-800"
                  : currentProgress > 0
                  ? "bg-indigo-100 text-indigo-800"
                  : "bg-gray-100 text-gray-700"
              }`}
              data-testid="resource-status-badge"
            >
              {statusLabel}
            </span>
            <span className="text-xs font-bold text-gray-700" data-testid="resource-progress-text">
              {currentProgress}%
            </span>
          </div>

          <form onSubmit={handleSaveProgress} noValidate className="flex items-center gap-1.5">
            <label htmlFor={`progress-input-${id}`} className="sr-only">
              Progress percentage for {bookmark?.title ?? "resource"}
            </label>
            <div className="flex items-center">
              <input
                id={`progress-input-${id}`}
                type="number"
                min="0"
                max="100"
                step="any"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError(null);
                }}
                disabled={isSaving}
                className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono disabled:opacity-50"
                aria-label={`Progress percentage for ${bookmark?.title ?? "resource"}`}
                data-testid="progress-input"
              />
              <span className="text-xs text-gray-500 ml-1">%</span>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              data-testid="save-progress-button"
              aria-label={`Save progress for ${bookmark?.title ?? "resource"}`}
            >
              {isSaving ? "Saving..." : "Save Progress"}
            </button>
          </form>
        </div>

        {/* Resource-level progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              currentProgress >= 100 ? "bg-green-600" : "bg-indigo-600"
            }`}
            style={{ width: `${currentProgress}%` }}
            role="progressbar"
            aria-valuenow={currentProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            data-testid="resource-progress-bar"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-1 font-medium" role="alert" data-testid="progress-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
