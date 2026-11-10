"use client";

import React from 'react';
import type { LearningPathItem } from '@/types/learning-path';

interface Props {
  item: LearningPathItem;
  onToggle: (itemId: string, completed: boolean) => Promise<void>;
  onMove: (itemId: string, direction: 'up' | 'down') => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}

export default function LearningPathItemCard({ item, onToggle, onMove, onDelete }: Props) {
  const { id, position, is_completed, bookmark } = item;

  const handleToggle = async () => {
    await onToggle(id, !is_completed);
  };

  const handleMove = async (dir: 'up' | 'down') => {
    await onMove(id, dir);
  };

  const handleDelete = async () => {
    if (confirm('Remove this item from the learning path?')) {
      await onDelete(id);
    }
  };

  return (
    <div className="border rounded p-2 mb-2 flex items-center justify-between">
      <div className="flex-1">
        {bookmark ? (
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            {bookmark.title}
          </a>
        ) : (
          <span className="text-gray-500">(bookmark unavailable)</span>
        )}
      </div>
      <div className="flex items-center space-x-1 ml-2">
        <button
          className={`px-1 py-0.5 text-sm rounded ${is_completed ? 'bg-green-200' : 'bg-gray-200'}`}
          onClick={handleToggle}
        >
          {is_completed ? 'Done' : 'Mark'}
        </button>
        <button className="px-1 py-0.5 text-sm rounded bg-indigo-200" onClick={() => handleMove('up')} disabled={position === 0}>↑</button>
        <button className="px-1 py-0.5 text-sm rounded bg-indigo-200" onClick={() => handleMove('down')}>↓</button>
        <button className="px-1 py-0.5 text-sm rounded bg-red-200" onClick={handleDelete}>✕</button>
      </div>
    </div>
  );
}
