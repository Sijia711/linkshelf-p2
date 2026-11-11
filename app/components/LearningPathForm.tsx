"use client";

import React, { useState } from "react";

interface LearningPathFormProps {
  initial?: { title: string; description?: string };
  onCancel: () => void;
  onSubmit: (data: { title: string; description?: string }) => Promise<void>;
}

export default function LearningPathForm({ initial, onCancel, onSubmit }: LearningPathFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({ title: trimmedTitle, description: description.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save learning path");
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="bg-white border border-gray-200 rounded-lg p-5 mb-6 shadow-sm"
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
      data-testid="learning-path-form"
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        {initial ? "Edit Learning Path" : "Create New Learning Path"}
      </h2>
      {error && (
        <div
          role="alert"
          className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded"
          data-testid="form-error-alert"
        >
          {error}
        </div>
      )}
      <div className="mb-3">
        <label htmlFor="lp-title" className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="lp-title"
          className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., LLM & AI Engineering"
          disabled={isSubmitting}
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="lp-description" className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="lp-description"
          className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What will you learn in this path? Add milestones or goals."
          disabled={isSubmitting}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
          disabled={isSubmitting || !title.trim()}
          data-testid="save-path-button"
        >
          {isSubmitting ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-400 cursor-pointer"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
