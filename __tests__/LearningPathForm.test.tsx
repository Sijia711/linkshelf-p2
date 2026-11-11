// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LearningPathForm from "@/app/components/LearningPathForm";

afterEach(cleanup);

describe("LearningPathForm Component", () => {
  it("renders form fields and cancels correctly", async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<LearningPathForm onCancel={onCancel} onSubmit={onSubmit} />);

    expect(screen.getByRole("heading", { name: /Create New Learning Path/i })).not.toBeNull();
    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    await user.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("submits valid title and description", async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<LearningPathForm onCancel={onCancel} onSubmit={onSubmit} />);

    const titleInput = screen.getByLabelText(/Title/i);
    const descInput = screen.getByLabelText(/Description/i);
    const saveBtn = screen.getByTestId("save-path-button");

    await user.type(titleInput, "LLM Roadmap");
    await user.type(descInput, "Curated list of tutorials");
    await user.click(saveBtn);

    expect(onSubmit).toHaveBeenCalledWith({
      title: "LLM Roadmap",
      description: "Curated list of tutorials",
    });
  });

  it("prevents duplicate submissions while a request is in flight", async () => {
    const onCancel = vi.fn();
    let resolveSubmit: () => void = () => {};
    const deferredPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const onSubmit = vi.fn().mockImplementation(() => deferredPromise);
    const user = userEvent.setup();

    render(<LearningPathForm onCancel={onCancel} onSubmit={onSubmit} />);

    const titleInput = screen.getByLabelText(/Title/i);
    const saveBtn = screen.getByTestId("save-path-button");

    await user.type(titleInput, "LLM");

    // Click Save once
    await user.click(saveBtn);

    // Verify it is now submitting
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
    expect(saveBtn.textContent).toContain("Saving...");
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Try clicking again rapidly
    await user.click(saveBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Resolve in-flight request
    resolveSubmit();
  });

  it("re-enables form and displays error if submission fails", async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Server timeout"));
    const user = userEvent.setup();

    render(<LearningPathForm onCancel={onCancel} onSubmit={onSubmit} />);

    const titleInput = screen.getByLabelText(/Title/i);
    const saveBtn = screen.getByTestId("save-path-button");

    await user.type(titleInput, "LLM Crash Course");
    await user.click(saveBtn);

    expect(onSubmit).toHaveBeenCalledOnce();
    const errorAlert = await screen.findByTestId("form-error-alert");
    expect(errorAlert.textContent).toContain("Server timeout");
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
    expect(saveBtn.textContent).toBe("Save");
  });
});
