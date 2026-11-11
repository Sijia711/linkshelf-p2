"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookmarkWorkspace,
  type BookmarkInput,
  type BookmarkRecord,
} from "@/features/bookmark-ui";
import type { ApiResult, Bookmark, BookmarkListPayload } from "@/types/bookmark";

function toRecord(b: Bookmark): BookmarkRecord {
  return {
    id: b.id,
    title: b.title,
    url: b.url,
    tags: b.tags,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  };
}

async function apiRequest<T>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as ApiResult<T> | null;

  if (!res.ok || !json || json.error !== null) {
    throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  }

  return json.data;
}

export default function BookmarkDashboardClient() {
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchBookmarks = useCallback(async () => {
    try {
      const data = await apiRequest<BookmarkListPayload>("/api/bookmarks");
      setBookmarks(data.bookmarks.map(toRecord));
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load bookmarks."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await fetchBookmarks();
    };
    if (isMounted) {
      void load();
    }
    return () => {
      isMounted = false;
    };
  }, [fetchBookmarks]);

  const handleCreate = async (input: BookmarkInput) => {
    await apiRequest<Bookmark>("/api/bookmarks", "POST", input);
    await fetchBookmarks();
  };

  const handleUpdate = async (id: string, input: BookmarkInput) => {
    await apiRequest<Bookmark>(`/api/bookmarks/${id}`, "PATCH", input);
    await fetchBookmarks();
  };

  const handleDelete = async (id: string) => {
    await apiRequest<{ id: string; deleted: boolean }>(
      `/api/bookmarks/${id}`,
      "DELETE"
    );
    await fetchBookmarks();
  };

  const handleBulkDelete = async (ids: string[]) => {
    await apiRequest<{ affected_count: number }>(
      "/api/bookmarks/bulk-delete",
      "POST",
      { ids }
    );
    await fetchBookmarks();
  };

  const handleRestore = async (ids: string[]) => {
    await apiRequest<{ affected_count: number }>(
      "/api/bookmarks/bulk-restore",
      "POST",
      { ids }
    );
    await fetchBookmarks();
  };

  return (
    <BookmarkWorkspace
      bookmarks={bookmarks}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onBulkDelete={handleBulkDelete}
      onRestore={handleRestore}
    />
  );
}
