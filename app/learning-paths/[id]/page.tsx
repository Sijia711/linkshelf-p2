"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { LearningPathDetail } from "@/types/learning-path";
import type { Bookmark } from "@/types/bookmark";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import LearningPathItemCard from "@/app/components/LearningPathItemCard";
import { extractDomain } from "@/lib/learning-paths";

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2 overflow-hidden" data-testid="progress-bar">
      <div
        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export default function LearningPathDetailPage() {
  const { id } = useParams() as { id: string };
  const [path, setPath] = useState<LearningPathDetail | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const [pathRes, bmRes] = await Promise.all([
        fetch(`/api/learning-paths/${id}`),
        fetch("/api/bookmarks"),
      ]);
      const pathJson = await pathRes.json();
      const bmJson = await bmRes.json();
      if (!pathRes.ok) throw new Error(pathJson.error?.message ?? "Failed to load path");
      if (!bmRes.ok) throw new Error(bmJson.error?.message ?? "Failed to load bookmarks");
      setPath(pathJson.data?.learning_path ?? null);
      setBookmarks(bmJson.data?.bookmarks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await fetchData();
    };
    if (isMounted) {
      void load();
    }
    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  const refresh = async () => {
    await fetchData();
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookmark || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/learning-paths/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmark_id: selectedBookmark }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to add resource");
      setSelectedBookmark("");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      alert(`Error: ${msg}`);
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (itemId: string, completed: boolean) => {
    const res = await fetch(`/api/learning-paths/${id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_completed: completed }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error?.message ?? "Toggle failed");
    }
    await refresh();
  };

  const handleMove = async (itemId: string, direction: "up" | "down") => {
    const res = await fetch(`/api/learning-paths/${id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error?.message ?? "Reorder failed");
    }
    await refresh();
  };

  const handleDelete = async (itemId: string) => {
    const res = await fetch(`/api/learning-paths/${id}/items/${itemId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error?.message ?? "Delete failed");
    }
    await refresh();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 p-6">Error: {error}</div>;
  if (!path) return <div className="p-6">Learning path not found.</div>;

  const { title, description, items, progress_percentage, total_items, completed_items } = path;
  const sortedItems = [...items].sort((a, b) => a.position - b.position);

  // Available bookmarks are active bookmarks not already added to this learning path
  const availableBookmarks = bookmarks.filter(
    (b) => !items.some((item) => item.bookmark_id === b.id)
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/learning-paths"
          className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-4"
        >
          ← Back to Learning Paths
        </Link>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="text-gray-600 mt-1 text-sm sm:text-base">{description}</p>
          )}

          <div className="mt-5">
            <div className="flex justify-between text-xs sm:text-sm font-medium text-gray-700 mb-1">
              <span>Overall Progress</span>
              <span>{completed_items} of {total_items} completed ({progress_percentage}%)</span>
            </div>
            <ProgressBar percentage={progress_percentage} />
          </div>
        </div>

        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Ordered Resources</h2>
            <span className="text-xs text-gray-500">
              {items.length} {items.length === 1 ? "resource" : "resources"}
            </span>
          </div>

          {sortedItems.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-600 mb-6">
              <p className="font-medium text-gray-800">No resources added to this learning path yet.</p>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                Add bookmarks below to turn this path into an ordered playlist for videos, articles, and documentation.
              </p>
            </div>
          ) : (
            <div>
              {sortedItems.map((item, index) => (
                <LearningPathItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === sortedItems.length - 1}
                  onToggle={handleToggle}
                  onMove={handleMove}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-2">Add Resource to Path</h3>
          <p className="text-xs text-gray-500 mb-4">
            Select an existing bookmark to append to your study playlist.
          </p>

          {bookmarks.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-900">
              <p className="font-medium">No bookmarks saved in LinkShelf yet</p>
              <p className="mt-1 text-amber-800 text-xs sm:text-sm">
                Learning paths organize your saved bookmarks into a step-by-step playlist. Please save your video tutorials or articles in your Bookmarks dashboard first.
              </p>
              <Link
                href="/dashboard"
                className="inline-block mt-3 text-sm text-indigo-700 font-semibold hover:underline"
              >
                Go to Dashboard to add bookmarks →
              </Link>
            </div>
          ) : availableBookmarks.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-900">
              <p className="font-medium">All existing bookmarks are already in this learning path</p>
              <p className="mt-1 text-blue-800 text-xs sm:text-sm">
                To add more tutorials or articles, save new bookmarks in your Dashboard.
              </p>
              <Link
                href="/dashboard"
                className="inline-block mt-3 text-sm text-indigo-700 font-semibold hover:underline"
              >
                Add more bookmarks in Dashboard →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <select
                className="border border-gray-300 rounded-md p-2 text-sm flex-1 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={selectedBookmark}
                onChange={(e) => setSelectedBookmark(e.target.value)}
                required
                disabled={adding}
                aria-label="Select bookmark to add"
              >
                <option value="">Select a bookmark to add...</option>
                {availableBookmarks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({extractDomain(b.url)})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                disabled={adding || !selectedBookmark}
              >
                {adding ? "Adding..." : "Add to Path"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
