// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
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
  progress_percentage: 0,
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
  const onUpdateProgress = vi.fn().mockResolvedValue(undefined);
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
      onUpdateProgress={onUpdateProgress}
      onToggle={onToggle}
      onMove={onMove}
      onDelete={onDelete}
      {...propsOverrides}
    />
  );

  return {
    ...utils,
    onUpdateProgress,
    onToggle,
    onMove,
    onDelete,
    item,
    user: userEvent.setup(),
  };
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

  it("renders status badges and resource progress accurately for 0%, 30%, and 100%", () => {
    // 0% - Not Started
    setup({ progress_percentage: 0 });
    expect(screen.getByTestId("resource-status-badge").textContent).toBe("Not Started");
    expect(screen.getByTestId("resource-progress-text").textContent).toBe("0%");
    cleanup();

    // 30% - In Progress
    setup({ progress_percentage: 30 });
    expect(screen.getByTestId("resource-status-badge").textContent).toBe("In Progress");
    expect(screen.getByTestId("resource-progress-text").textContent).toBe("30%");
    cleanup();

    // 100% - Completed
    setup({ progress_percentage: 100, is_completed: true });
    expect(screen.getByTestId("resource-status-badge").textContent).toBe("Completed");
    expect(screen.getByTestId("resource-progress-text").textContent).toBe("100%");
  });

  it("saves valid progress values: 30 and 100", async () => {
    const { user, onUpdateProgress } = setup();

    const input = screen.getByTestId("progress-input");
    const saveBtn = screen.getByTestId("save-progress-button");

    // Save 30
    await user.clear(input);
    await user.type(input, "30");
    await user.click(saveBtn);
    expect(onUpdateProgress).toHaveBeenCalledWith("item-1", 30);

    onUpdateProgress.mockClear();

    // Save 100
    await user.clear(input);
    await user.type(input, "100");
    await user.click(saveBtn);
    expect(onUpdateProgress).toHaveBeenCalledWith("item-1", 100);
  });

  it("truncates decimal input 20.78 to 20 without rounding up to 21", async () => {
    const { user, onUpdateProgress } = setup();

    const input = screen.getByTestId("progress-input") as HTMLInputElement;
    const saveBtn = screen.getByTestId("save-progress-button");

    await user.clear(input);
    await user.type(input, "20.78");
    await user.click(saveBtn);

    expect(onUpdateProgress).toHaveBeenCalledWith("item-1", 20);
    expect(input.value).toBe("20");
    expect(screen.queryByTestId("progress-error")).toBeNull();
  });

  it("rejects out-of-range values 120 and -20 without calling onUpdateProgress", async () => {
    const { user, onUpdateProgress } = setup();

    const input = screen.getByTestId("progress-input");
    const saveBtn = screen.getByTestId("save-progress-button");

    // Test 120
    await user.clear(input);
    await user.type(input, "120");
    await user.click(saveBtn);

    expect(onUpdateProgress).not.toHaveBeenCalled();
    const errorEl1 = screen.getByTestId("progress-error");
    expect(errorEl1.textContent).toContain("between 0 and 100");

    // Test -20
    await user.clear(input);
    await user.type(input, "-20");
    await user.click(saveBtn);

    expect(onUpdateProgress).not.toHaveBeenCalled();
    const errorEl2 = screen.getByTestId("progress-error");
    expect(errorEl2.textContent).toContain("between 0 and 100");
  });

  it("disables save button while update request is in flight", async () => {
    let resolveUpdate: () => void = () => {};
    const deferredPromise = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });
    const slowUpdate = vi.fn().mockReturnValue(deferredPromise);

    const { user } = setup({}, { onUpdateProgress: slowUpdate });

    const input = screen.getByTestId("progress-input");
    const saveBtn = screen.getByTestId("save-progress-button") as HTMLButtonElement;

    await user.clear(input);
    await user.type(input, "45");
    await user.click(saveBtn);

    expect(saveBtn.disabled).toBe(true);
    expect(saveBtn.textContent).toContain("Saving...");

    // Resolve deferred promise inside act
    await act(async () => {
      resolveUpdate();
    });
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
