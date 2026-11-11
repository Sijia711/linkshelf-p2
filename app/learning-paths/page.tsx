"use client";

"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LearningPathWithStats } from '@/types/learning-path';
import LoadingSpinner from '@/app/components/LoadingSpinner';

function LearningPathCard({ path, onEdit, onDelete }: { path: LearningPathWithStats; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const router = useRouter();
  const { id, title, description, progress_percentage, total_items, completed_items } = path;
  return (
    <div className="border rounded p-4 shadow hover:shadow-lg transition">
      <h3 className="text-lg font-semibold cursor-pointer" onClick={() => router.push(`/learning-paths/${id}`)}>{title}</h3>
      {description && <p className="text-sm text-gray-600 truncate">{description}</p>}
      <div className="mt-2 text-sm">
        <span>{completed_items}/{total_items} completed</span>
        <div className="w-full bg-gray-200 rounded h-2 mt-1">
          <div className="bg-indigo-600 h-2 rounded" style={{ width: `${progress_percentage}%` }} />
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <button className="px-2 py-1 bg-blue-200 rounded" onClick={() => onEdit(id)}>Edit</button>
        <button className="px-2 py-1 bg-red-200 rounded" onClick={() => onDelete(id)}>Delete</button>
      </div>
    </div>
  );
}

function LearningPathForm({ initial, onCancel, onSubmit }: { initial?: { title: string; description?: string }; onCancel: () => void; onSubmit: (data: { title: string; description?: string }) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ title, description });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };
  return (
    <form className="border rounded p-4 mb-4" onSubmit={handleSubmit}>
      <h2 className="text-xl mb-2">{initial ? 'Edit Learning Path' : 'Create New Learning Path'}</h2>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <div className="mb-2">
        <label htmlFor="lp-title" className="block text-sm font-medium">Title</label>
        <input id="lp-title" className="w-full border rounded p-1" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="mb-2">
        <label htmlFor="lp-description" className="block text-sm font-medium">Description (optional)</label>
        <textarea id="lp-description" className="w-full border rounded p-1" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="px-3 py-1 bg-indigo-600 text-white rounded">Save</button>
        <button type="button" className="px-3 py-1 bg-gray-300 rounded" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function LearningPathsPage() {
  const [paths, setPaths] = useState<LearningPathWithStats[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchPaths = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/learning-paths');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to fetch');
      setPaths(json.data?.learning_paths ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      await fetchPaths();
    };
    load();
  }, []);


  const handleCreate = async (data: { title: string; description?: string }) => {
    const res = await fetch('/api/learning-paths', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? 'Create failed');
    setShowForm(false);
    await fetchPaths();
  };

  const handleEdit = async (id: string, data: { title?: string; description?: string }) => {
    const res = await fetch(`/api/learning-paths/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? 'Update failed');
    setEditId(null);
    await fetchPaths();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this learning path?')) return;
    const res = await fetch(`/api/learning-paths/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? 'Delete failed');
    await fetchPaths();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 p-4">Error: {error}</div>;

  const editingPath = editId ? paths?.find((p) => p.id === editId) : null;

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Learning Paths</h1>
      {showForm && <LearningPathForm onCancel={() => setShowForm(false)} onSubmit={handleCreate} />}
      {editingPath && (
        <LearningPathForm
          initial={{ title: editingPath.title, description: editingPath.description }}
          onCancel={() => setEditId(null)}
          onSubmit={(data) => handleEdit(editingPath.id, data)}
        />
      )}
      <button className="mb-4 px-3 py-1 bg-indigo-600 text-white rounded" onClick={() => setShowForm(true)} disabled={showForm || !!editingPath}>
        + New Learning Path
      </button>
      {(!paths || paths.length === 0) ? (
        <div className="text-gray-600">You have no learning paths yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paths.map((p) => (
            <LearningPathCard key={p.id} path={p} onEdit={(id) => setEditId(id)} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
