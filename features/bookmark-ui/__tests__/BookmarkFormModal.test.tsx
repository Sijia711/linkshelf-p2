// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookmarkFormModal } from "../BookmarkFormModal";
import type { BookmarkInput } from "../types";
import { EMPTY_FORM_VALUES, type BookmarkFormValues } from "../validation";

afterEach(cleanup);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup(mode: "create" | "edit" = "create", initialValues: BookmarkFormValues = EMPTY_FORM_VALUES) {
  const onSubmit = vi.fn<(input: BookmarkInput) => Promise<void>>(async () => {});
  const onCancel = vi.fn<() => void>();
  render(<BookmarkFormModal mode={mode} initialValues={initialValues} onSubmit={onSubmit} onCancel={onCancel} />);
  return { onSubmit, onCancel, user: userEvent.setup() };
}

describe("BookmarkFormModal", () => {
  it("is an accessible modal dialog that focuses the title field", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Add Bookmark" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Title"));
  });

  it("shows inline errors and does not submit an empty form", async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Title is required.")).not.toBeNull();
    expect(screen.getByText("URL is required.")).not.toBeNull();
    expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Title"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a javascript: URL", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText("Title"), "Bad link");
    await user.type(screen.getByLabelText("URL"), "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("URL must use http:// or https:// protocol.")).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("URL"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("pre-fills values in edit mode", () => {
    setup("edit", { title: "MDN Web Docs", url: "https://developer.mozilla.org", tagsText: "dev, reference" });
    expect(screen.getByRole("dialog", { name: "Edit Bookmark" })).not.toBeNull();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("MDN Web Docs");
    expect((screen.getByLabelText(/Tags/) as HTMLInputElement).value).toBe("dev, reference");
  });

  it("calls onCancel from the Cancel button and from Escape", async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByLabelText("Title"));
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("keeps keyboard focus inside the dialog when tabbing", async () => {
    const { user } = setup();
    act(() => screen.getByRole("button", { name: "Save" }).focus());
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Title"));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save" }));
  });

  it("ignores Escape while a save is in progress", async () => {
    const pending = deferred();
    const onSubmit = vi.fn<(input: BookmarkInput) => Promise<void>>(() => pending.promise);
    const onCancel = vi.fn<() => void>();
    const user = userEvent.setup();
    render(
      <BookmarkFormModal
        mode="edit"
        initialValues={{ title: "React", url: "https://react.dev", tagsText: "" }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Saving…" })).not.toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => pending.resolve());
  });
});
