// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkActionBar, UndoNotice } from "../BulkActionBar";

afterEach(cleanup);

function renderBar(selectedCount: number) {
  const onDeleteSelected = vi.fn<() => void>();
  const onClearSelection = vi.fn<() => void>();
  render(
    <BulkActionBar
      selectedCount={selectedCount}
      onDeleteSelected={onDeleteSelected}
      onClearSelection={onClearSelection}
    />,
  );
  return { onDeleteSelected, onClearSelection, user: userEvent.setup() };
}

describe("BulkActionBar", () => {
  it("allows deleting up to the 100-bookmark server limit", async () => {
    const { user, onDeleteSelected } = renderBar(100);
    const button = screen.getByRole("button", { name: "Delete Selected" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await user.click(button);
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it("blocks bulk delete above the limit and explains why", () => {
    renderBar(101);
    const button = screen.getByRole("button", { name: "Delete Selected" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("You can delete up to 100 bookmarks at a time.")).not.toBeNull();
  });

  it("clears the selection from its own button", async () => {
    const { user, onClearSelection } = renderBar(2);
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });
});

describe("UndoNotice", () => {
  it("uses singular wording for one bookmark and disables actions while restoring", () => {
    render(
      <UndoNotice deletedCount={1} isRestoring errorMessage={null} onUndo={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText("Deleted 1 bookmark.")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Restoring…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Dismiss" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
