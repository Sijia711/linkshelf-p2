// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LearningPathItemCard from "@/app/components/LearningPathItemCard";
import type { LearningPathItem } from "@/types/learning-path";

afterEach(cleanup);

const mockItem: LearningPathItem = {
  id: "item-1",
  learning_path_id: "path-123",
  bookmark_id: "bm-1",
  user_id: "user-1",
  position: 0,
  is_completed: false,
  completed_at: null,
  created_at: "2026-11-10T12:00:00.000Z",
  updated_at: "2026-11-10T12:00:00.000Z",
  bookmark: {
    id: "bm-1",
    user_id: "user-1",
    title: "Intro to LLMs by Andrej Karpathy",
    url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
    tags: ["llm", "ai", "video"],
    created_at: "2026-11-10T12:00:00.000Z",
    updated_at: "2026-11-10T12:00:00.000Z",
    deleted_at: null,
  },
};

function setup(overrides: Partial<LearningPathItem> = {}, propsOverrides = {}) {
  const onToggle = vi.fn().mockResolvedValue(undefined);
  const onMove = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const item = { ...mockItem, ...overrides };

  const utils = render(
    <LearningPathItemCard
      item={item}
      index={item.position}
      isFirst={item.position === 0}
      isLast={false}
      onToggle={onToggle}
      onMove={onMove}
      onDelete={onDelete}
      {...propsOverrides}
    />
  );

  return { ...utils, onToggle, onMove, onDelete, item, user: userEvent.setup() };
}

describe("LearningPathItemCard Component", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders the resource title and an explicit 'Open Resource ↗' link with safe attributes", () => {
    setup();

    const titleLink = screen.getByTestId("resource-title-link");
    expect(titleLink.getAttribute("href")).toBe("https://www.youtube.com/watch?v=zjkBMFhNj_g");
    expect(titleLink.getAttribute("target")).toBe("_blank");
    expect(titleLink.getAttribute("rel")).toBe("noopener noreferrer");

    const openLink = screen.getByTestId("open-resource-link");
    expect(openLink.getAttribute("href")).toBe("https://www.youtube.com/watch?v=zjkBMFhNj_g");
    expect(openLink.getAttribute("target")).toBe("_blank");
    expect(openLink.getAttribute("rel")).toBe("noopener noreferrer");
    expect(openLink.textContent).toContain("Open Resource ↗");
  });

  it("displays extracted domain context and tags", () => {
    setup();
    expect(screen.getByText("youtube.com")).not.toBeNull();
    expect(screen.getByText("#llm")).not.toBeNull();
    expect(screen.getByText("#ai")).not.toBeNull();
  });

  it("toggles completion without link clicks marking it complete", async () => {
    const { user, onToggle } = setup();

    // Clicking the toggle button calls onToggle
    const toggleBtn = screen.getByTestId("toggle-completion-button");
    expect(toggleBtn.textContent).toBe("Mark");
    await user.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledWith("item-1", true);

    // Clicking the link does NOT trigger onToggle
    onToggle.mockClear();
    const titleLink = screen.getByTestId("resource-title-link");
    await user.click(titleLink);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("handles reordering and respects boundary disable states", async () => {
    // First item: Up should be disabled, Down enabled
    const first = setup({ position: 0 }, { isFirst: true, isLast: false });
    const upBtn = screen.getByRole("button", { name: "Move item up" }) as HTMLButtonElement;
    const downBtn = screen.getByRole("button", { name: "Move item down" }) as HTMLButtonElement;

    expect(upBtn.disabled).toBe(true);
    expect(downBtn.disabled).toBe(false);

    await first.user.click(downBtn);
    expect(first.onMove).toHaveBeenCalledWith("item-1", "down");
    cleanup();

    // Last item: Up should be enabled, Down disabled
    const last = setup({ position: 2 }, { isFirst: false, isLast: true });
    const upBtn2 = screen.getByRole("button", { name: "Move item up" }) as HTMLButtonElement;
    const downBtn2 = screen.getByRole("button", { name: "Move item down" }) as HTMLButtonElement;

    expect(upBtn2.disabled).toBe(false);
    expect(downBtn2.disabled).toBe(true);

    await last.user.click(upBtn2);
    expect(last.onMove).toHaveBeenCalledWith("item-1", "up");
  });

  it("confirms before deleting a path resource", async () => {
    const { user, onDelete } = setup();
    const deleteBtn = screen.getByRole("button", { name: "Remove item" });
    await user.click(deleteBtn);
    expect(window.confirm).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith("item-1");
  });
});
