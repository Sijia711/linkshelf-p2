"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { LearningPathWithStats } from "@/types/learning-path";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import LearningPathCard from "@/app/components/LearningPathCard";
import LearningPathForm from "@/app/components/LearningPathForm";

export default function LearningPathsPage() {
  const [paths, setPaths] = useState<LearningPathWithStats[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const fetchPaths = useCallback(async () => {
    try {
      const res = await fetch("/api/learning-paths");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to fetch");
      setPaths(json.data?.learning_paths ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load learning paths");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await fetchPaths();
    };
    if (isMounted) {
      void load();
    }
    return () => {
      isMounted = false;
    };
  }, [fetchPaths]);

  const handleCreate = async (data: { title: string; description?: string }) => {
    if (isSubmittingAction) return;
    setIsSubmittingAction(true);
    try {
      const res = await fetch("/api/learning-paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Create failed");
      setShowForm(false);
      await fetchPaths();
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleEdit = async (id: string, data: { title?: string; description?: string }) => {
    if (isSubmittingAction) return;
    setIsSubmittingAction(true);
    try {
      const res = await fetch(`/api/learning-paths/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Update failed");
      setEditId(null);
      await fetchPaths();
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this learning path?")) return;
    const res = await fetch(`/api/learning-paths/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Delete failed");
    await fetchPaths();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 p-6">Error: {error}</div>;

  const editingPath = editId ? paths?.find((p) => p.id === editId) : null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <span className="text-xl font-bold tracking-tight text-gray-900">
              LinkShelf
            </span>
            <nav className="flex space-x-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Bookmarks
              </Link>
              <Link
                href="/learning-paths"
                className="text-sm font-semibold text-blue-600 hover:text-blue-800"
              >
                Learning Paths
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Learning Paths</h1>
            <p className="text-sm text-gray-500 mt-1">
              Curate ordered learning sequences, study roadmaps, and video playlists from your saved bookmarks.
            </p>
          </div>
          <button
            type="button"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition disabled:opacity-50 cursor-pointer"
            onClick={() => setShowForm(true)}
            disabled={showForm || !!editingPath}
          >
            + New Learning Path
          </button>
        </div>

        {showForm && (
          <LearningPathForm onCancel={() => setShowForm(false)} onSubmit={handleCreate} />
        )}

        {editingPath && (
          <LearningPathForm
            initial={{ title: editingPath.title, description: editingPath.description }}
            onCancel={() => setEditId(null)}
            onSubmit={(data) => handleEdit(editingPath.id, data)}
          />
        )}

        {!paths || paths.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-600 my-6">
            <h3 className="text-lg font-medium text-gray-900">No learning paths yet</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Create a learning path to organize your bookmarks into structured playlists for YouTube courses, reading lists, or tutorials.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow transition cursor-pointer"
            >
              + Create Your First Learning Path
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((p) => (
              <LearningPathCard
                key={p.id}
                path={p}
                onEdit={(id) => setEditId(id)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
