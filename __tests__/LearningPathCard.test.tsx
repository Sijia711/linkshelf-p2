// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LearningPathCard from "@/app/components/LearningPathCard";
import type { LearningPathWithStats } from "@/types/learning-path";

afterEach(cleanup);

const mockPath: LearningPathWithStats = {
  id: "path-123",
  user_id: "user-abc",
  title: "LLM & Agent Architecture",
  description: "Master modern AI agents and LLM tooling step by step.",
  created_at: "2026-11-10T12:00:00.000Z",
  updated_at: "2026-11-10T12:00:00.000Z",
  total_items: 5,
  completed_items: 2,
  progress_percentage: 40,
};

function setup(overrides: Partial<LearningPathWithStats> = {}) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const path = { ...mockPath, ...overrides };
  const utils = render(<LearningPathCard path={path} onEdit={onEdit} onDelete={onDelete} />);
  return { ...utils, onEdit, onDelete, path, user: userEvent.setup() };
}

describe("LearningPathCard Component", () => {
  it("renders path title as link to /learning-paths/[id]", () => {
    setup();
    const titleLink = screen.getByTestId("learning-path-title-link");
    expect(titleLink.getAttribute("href")).toBe("/learning-paths/path-123");
    expect(titleLink.textContent).toBe("LLM & Agent Architecture");
  });

  it("provides an explicit 'Open Path →' navigation button linking to /learning-paths/[id]", () => {
    setup();
    const openBtn = screen.getByTestId("open-path-button");
    expect(openBtn).not.toBeNull();
    expect(openBtn.getAttribute("href")).toBe("/learning-paths/path-123");
    expect(openBtn.textContent).toContain("Open Path →");
  });

  it("displays progress stats and progress bar", () => {
    setup();
    expect(screen.getByText("2/5 done")).not.toBeNull();
    expect(screen.getByText("40%")).not.toBeNull();
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBe("40");
  });

  it("invokes onEdit and onDelete handlers cleanly", async () => {
    const { user, onEdit, onDelete } = setup();

    await user.click(screen.getByRole("button", { name: /Edit LLM & Agent Architecture/i }));
    expect(onEdit).toHaveBeenCalledWith("path-123");

    await user.click(screen.getByRole("button", { name: /Delete LLM & Agent Architecture/i }));
    expect(onDelete).toHaveBeenCalledWith("path-123");
  });
});
