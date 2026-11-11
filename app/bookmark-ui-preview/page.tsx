"use client";

/**
 * TEMPORARY PREVIEW — mock data only, no persistence, no auth.
 * Demonstrates the backend-agnostic BookmarkWorkspace with in-memory callbacks.
 * Developer A may remove or protect this route after production integration.
 */

import { useState } from "react";
import { BookmarkWorkspace } from "@/features/bookmark-ui";
import type { BookmarkInput, BookmarkRecord } from "@/features/bookmark-ui";

function mock(id: number, title: string, url: string, tags: string[]): BookmarkRecord {
  const timestamp = new Date(Date.UTC(2026, 10, 1 + id, 10)).toISOString();
  return { id: `mock-${id}`, title, url, tags, createdAt: timestamp, updatedAt: timestamp };
}

const MOCK_BOOKMARKS: BookmarkRecord[] = [
  mock(6, "MDN Web Docs", "https://developer.mozilla.org", ["dev", "reference"]),
  mock(5, "A List Apart", "https://alistapart.com", ["design", "reading"]),
  mock(4, "Smashing Magazine", "https://smashingmagazine.com", ["design", "dev"]),
  mock(3, "Postgres Documentation", "https://postgresql.org/docs", ["dev", "reference"]),
  mock(2, "Refactoring UI", "https://refactoringui.com", ["design"]),
  mock(1, "The Pragmatic Engineer", "https://newsletter.pragmaticengineer.com", ["reading"]),
];

const LATENCY_MS = 400;

function newestFirst(list: BookmarkRecord[]): BookmarkRecord[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export default function BookmarkUiPreviewPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>(MOCK_BOOKMARKS);
  const [softDeleted, setSoftDeleted] = useState<BookmarkRecord[]>([]);
  const [simulateFailure, setSimulateFailure] = useState(false);

  async function simulateRequest() {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
    if (simulateFailure) throw new Error("Simulated failure");
  }

  async function onCreate(input: BookmarkInput) {
    await simulateRequest();
    const now = new Date().toISOString();
    const created: BookmarkRecord = { id: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now };
    setBookmarks((prev) => [created, ...prev]);
  }

  async function onUpdate(id: string, input: BookmarkInput) {
    await simulateRequest();
    const now = new Date().toISOString();
    setBookmarks((prev) => prev.map((b) => (b.id === id ? { ...b, ...input, updatedAt: now } : b)));
  }

  async function onDelete(id: string) {
    await simulateRequest();
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }

  async function onBulkDelete(ids: string[]) {
    await simulateRequest();
    const idSet = new Set(ids);
    setSoftDeleted(bookmarks.filter((b) => idSet.has(b.id)));
    setBookmarks((prev) => prev.filter((b) => !idSet.has(b.id)));
  }

  async function onRestore(ids: string[]) {
    await simulateRequest();
    const idSet = new Set(ids);
    const restored = softDeleted.filter((b) => idSet.has(b.id));
    setBookmarks((prev) => newestFirst([...restored, ...prev.filter((b) => !idSet.has(b.id))]));
    setSoftDeleted([]);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="text-xl font-bold text-gray-900">
            Link<span className="text-indigo-600">Shelf</span>
          </span>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
              Simulate failures
            </label>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              Preview · mock data
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <BookmarkWorkspace
          bookmarks={bookmarks}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onBulkDelete={onBulkDelete}
          onRestore={onRestore}
        />
      </main>
    </div>
  );
}
