// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookmarkCard } from "../BookmarkCard";
import type { BookmarkRecord } from "../types";

afterEach(cleanup);

const bookmark: BookmarkRecord = {
  id: "1",
  title: "MDN Web Docs",
  url: "https://developer.mozilla.org",
  tags: ["dev", "reference"],
  createdAt: "2026-11-05T10:00:00.000Z",
  updatedAt: "2026-11-05T10:00:00.000Z",
};

function setup(overrides: Partial<BookmarkRecord> = {}, isSelected = false) {
  const handlers = {
    onToggleSelected: vi.fn<(id: string) => void>(),
    onEdit: vi.fn<(b: BookmarkRecord) => void>(),
    onDelete: vi.fn<(b: BookmarkRecord) => void>(),
  };
  const record = { ...bookmark, ...overrides };
  const utils = render(<BookmarkCard bookmark={record} isSelected={isSelected} {...handlers} />);
  return { ...utils, ...handlers, record, user: userEvent.setup() };
}

describe("BookmarkCard", () => {
  it("opens the saved URL in a new tab with safe link attributes", () => {
    setup();
    const link = screen.getByRole("link", { name: "https://developer.mozilla.org" });
    expect(link.getAttribute("href")).toBe("https://developer.mozilla.org");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders the title as plain text, never as HTML", () => {
    const { container } = setup({ title: '<img src=x onerror="alert(1)">' });
    expect(screen.getByText('<img src=x onerror="alert(1)">')).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows each tag", () => {
    setup();
    expect(screen.getByText("dev")).not.toBeNull();
    expect(screen.getByText("reference")).not.toBeNull();
  });

  it("reports checkbox, Edit, and Delete interactions for this bookmark", async () => {
    const { user, onToggleSelected, onEdit, onDelete, record } = setup();

    await user.click(screen.getByRole("checkbox", { name: "Select MDN Web Docs" }));
    await user.click(screen.getByRole("button", { name: "Edit MDN Web Docs" }));
    await user.click(screen.getByRole("button", { name: "Delete MDN Web Docs" }));

    expect(onToggleSelected).toHaveBeenCalledWith("1");
    expect(onEdit).toHaveBeenCalledWith(record);
    expect(onDelete).toHaveBeenCalledWith(record);
  });

  it("reflects the selected state on the checkbox", () => {
    setup({}, true);
    const checkbox = screen.getByRole("checkbox", { name: "Select MDN Web Docs" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});
