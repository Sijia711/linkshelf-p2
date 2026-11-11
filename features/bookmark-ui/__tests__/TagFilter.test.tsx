// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TagFilter } from "../TagFilter";

afterEach(cleanup);

describe("TagFilter", () => {
  it("marks only the active chip as pressed", () => {
    render(<TagFilter tags={["design", "dev"]} activeTag="dev" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "dev" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "design" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("marks All as pressed when no tag is active", () => {
    render(<TagFilter tags={["design"]} activeTag={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("reports the clicked tag, and null for All", async () => {
    const onChange = vi.fn<(tag: string | null) => void>();
    const user = userEvent.setup();
    render(<TagFilter tags={["design", "dev"]} activeTag="dev" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "design" }));
    await user.click(screen.getByRole("button", { name: "All" }));

    expect(onChange).toHaveBeenNthCalledWith(1, "design");
    expect(onChange).toHaveBeenNthCalledWith(2, null);
  });
});
