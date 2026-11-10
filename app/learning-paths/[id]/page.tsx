"use client";




import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { LearningPathDetail } from '@/types/learning-path';
import type { Bookmark } from '@/types/bookmark';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import LearningPathItemCard from '@/app/components/LearningPathItemCard';

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="w-full bg-gray-200 rounded h-2 mt-2">
      <div className="bg-indigo-600 h-2 rounded" style={{ width: `${percentage}%` }} />
    </div>
  );
}

export default function LearningPathDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [path, setPath] = useState<LearningPathDetail | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pathRes, bmRes] = await Promise.all([
        fetch(`/api/learning-paths/${id}`),
        fetch('/api/bookmarks'),
      ]);
      const pathJson = await pathRes.json();
      const bmJson = await bmRes.json();
      if (!pathRes.ok) throw new Error(pathJson.error?.message ?? 'Failed to load path');
      if (!bmRes.ok) throw new Error(bmJson.error?.message ?? 'Failed to load bookmarks');
      setPath(pathJson.data?.learning_path ?? null);
      // Filter only active bookmarks (deleted_at null) – API already does this
      setBookmarks(bmJson.data?.bookmarks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
  const load = async () => {
    await fetchData();
  };
  load();
}, [fetchData]);

  const refresh = async () => {
    await fetchData();
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookmark) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/learning-paths/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmark_id: selectedBookmark }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Add failed');
      setSelectedBookmark('');
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
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: completed }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error?.message ?? 'Toggle failed');
    }
    await refresh();
  };

  const handleMove = async (itemId: string, direction: 'up' | 'down') => {
    const res = await fetch(`/api/learning-paths/${id}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error?.message ?? 'Reorder failed');
    }
    await refresh();
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Remove this item from the learning path?')) return;
    const res = await fetch(`/api/learning-paths/${id}/items/${itemId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error?.message ?? 'Delete failed');
    }
    await refresh();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 p-4">Error: {error}</div>;
  if (!path) return <div className="p-4">Learning path not found.</div>;

  const { title, description, items, progress_percentage } = path;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button className="mb-4 text-blue-600" onClick={() => router.back()}>← Back</button>
      <h1 className="text-2xl font-bold">{title}</h1>
      {description && <p className="text-gray-600 mb-2">{description}</p>}
      <ProgressBar percentage={progress_percentage} />
      <h2 className="mt-6 mb-2 text-xl">Items</h2>
      {items.length === 0 ? (
        <p className="text-gray-500">No items in this learning path yet.</p>
      ) : (
        items
          .sort((a, b) => a.position - b.position)
          .map((item) => (
            <LearningPathItemCard
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onMove={handleMove}
              onDelete={handleDelete}
            />
          ))
      )}
      <h3 className="mt-6 mb-2 text-lg">Add Bookmark</h3>
      <form onSubmit={handleAddItem} className="flex gap-2 items-center">
        <select
          className="border rounded p-1"
          value={selectedBookmark}
          onChange={(e) => setSelectedBookmark(e.target.value)}
          required
        >
          <option value="">Select a bookmark</option>
          {bookmarks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <button type="submit" className="px-3 py-1 bg-indigo-600 text-white rounded" disabled={adding}>
          {adding ? 'Adding...' : 'Add'}
        </button>
      </form>
    </div>
  );
}
