"use client";

import React from "react";
import Link from "next/link";
import type { LearningPathWithStats } from "@/types/learning-path";

interface LearningPathCardProps {
  path: LearningPathWithStats;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function LearningPathCard({ path, onEdit, onDelete }: LearningPathCardProps) {
  const { id, title, description, progress_percentage, total_items, completed_items } = path;

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow transition flex flex-col justify-between"
      data-testid={`learning-path-card-${id}`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">
            <Link
              href={`/learning-paths/${id}`}
              className="hover:text-indigo-600 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
              data-testid="learning-path-title-link"
            >
              {title}
            </Link>
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 whitespace-nowrap">
            {completed_items}/{total_items} done
          </span>
        </div>

        {description && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{description}</p>
        )}

        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{progress_percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress_percentage}%` }}
              role="progressbar"
              aria-valuenow={progress_percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <Link
          href={`/learning-paths/${id}`}
          className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-medium rounded-md shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          aria-label={`Open learning path ${title}`}
          data-testid="open-path-button"
        >
          Open Path →
        </Link>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(id);
            }}
            className="px-2.5 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs sm:text-sm font-medium rounded-md transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={`Edit ${title}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(id);
            }}
            className="px-2.5 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs sm:text-sm font-medium rounded-md transition focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label={`Delete ${title}`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
