import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

test.describe("Bookmark Dashboard E2E Operations", () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, "TEST_USER_EMAIL and TEST_USER_PASSWORD must be configured in environment");

  const createdBookmarkIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Authenticate and reach dashboard
    await page.goto("/login");
    await page.getByLabel(/email address/i).fill(TEST_EMAIL!);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test.afterEach(async ({ page }) => {
    // Clean up only test-created bookmarks via API
    for (const id of createdBookmarkIds) {
      try {
        await page.request.delete(`/api/bookmarks/${id}`);
      } catch {
        // ignore errors during cleanup
      }
    }
    createdBookmarkIds.length = 0;
  });

  test("can create a bookmark, filter by tag, search by title, and delete it", async ({ page }) => {
    const timestamp = Date.now();
    const bookmarkTitle = `E2E Playwright Link ${timestamp}`;
    const bookmarkUrl = `https://playwright.dev/test-${timestamp}`;
    const uniqueTag = `tag${timestamp}`;

    // 1. Click Add Bookmark button
    await page.getByRole("button", { name: /Add Bookmark/i }).click();

    // 2. Form modal opens
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // 3. Fill title, url, tags
    await dialog.getByLabel(/^Title/i).fill(bookmarkTitle);
    await dialog.getByLabel(/^URL/i).fill(bookmarkUrl);
    await dialog.getByLabel(/^Tags/i).fill(`${uniqueTag}, e2e`);

    // 4. Save bookmark
    await dialog.getByRole("button", { name: "Save" }).click();

    // 5. Verify the new bookmark appears on the dashboard
    await expect(page.locator("h3", { hasText: bookmarkTitle })).toBeVisible();

    // Track ID via API list for guaranteed cleanup
    const listRes = await page.request.get("/api/bookmarks");
    if (listRes.ok()) {
      const listData = await listRes.json();
      const match = listData.data.bookmarks.find((b: { title: string }) => b.title === bookmarkTitle);
      if (match) createdBookmarkIds.push(match.id);
    }

    // 6. Test Tag Filter: filter by uniqueTag
    const tagChip = page.getByRole("button", { name: uniqueTag, exact: true });
    await expect(tagChip).toBeVisible();
    await tagChip.click();
    await expect(page.locator("h3", { hasText: bookmarkTitle })).toBeVisible();

    // Clear tag filter by clicking All
    await page.getByRole("button", { name: "All", exact: true }).click();

    // 7. Test Search Bar: search for title
    const searchInput = page.getByRole("searchbox", { name: /Search bookmarks by title/i });
    await searchInput.fill(bookmarkTitle);
    await expect(page.locator("h3", { hasText: bookmarkTitle })).toBeVisible();

    // Clear search
    await searchInput.fill("");

    // 8. Test Delete with confirmation dialog
    const card = page.locator("article", { hasText: bookmarkTitle });
    await card.getByRole("button", { name: /Delete/i }).click();

    // Confirmation modal
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete" }).click();

    // 9. Verify removed from view
    await expect(page.locator("h3", { hasText: bookmarkTitle })).not.toBeVisible();
  });

  test("supports bulk selection, bulk delete, and one-step undo", async ({ page }) => {
    const timestamp = Date.now();
    const titleA = `Bulk Item A ${timestamp}`;
    const titleB = `Bulk Item B ${timestamp}`;

    // Create 2 test bookmarks via page.request
    const [resA, resB] = await Promise.all([
      page.request.post("/api/bookmarks", {
        data: { title: titleA, url: "https://example.com/a", tags: ["bulk"] },
      }),
      page.request.post("/api/bookmarks", {
        data: { title: titleB, url: "https://example.com/b", tags: ["bulk"] },
      }),
    ]);

    expect(resA.ok()).toBeTruthy();
    expect(resB.ok()).toBeTruthy();

    const jsonA = await resA.json();
    const jsonB = await resB.json();
    createdBookmarkIds.push(jsonA.data.id, jsonB.data.id);

    // Refresh dashboard to display new items
    await page.reload();
    await expect(page.locator("h3", { hasText: titleA })).toBeVisible();
    await expect(page.locator("h3", { hasText: titleB })).toBeVisible();

    // Select both cards using checkboxes
    const cardA = page.locator("article", { hasText: titleA });
    const cardB = page.locator("article", { hasText: titleB });

    await cardA.locator('input[type="checkbox"]').check();
    await cardB.locator('input[type="checkbox"]').check();

    // Bulk action bar should show selection count
    await expect(page.getByText(/2 selected/i)).toBeVisible();

    // Click "Delete Selected"
    await page.getByRole("button", { name: /Delete Selected/i }).click();

    // Confirmation dialog
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete" }).click();

    // Items should disappear
    await expect(page.locator("h3", { hasText: titleA })).not.toBeVisible();
    await expect(page.locator("h3", { hasText: titleB })).not.toBeVisible();

    // Undo button should appear
    const undoButton = page.getByRole("button", { name: /Undo/i });
    await expect(undoButton).toBeVisible();

    // Click Undo
    await undoButton.click();

    // Items should be restored
    await expect(page.locator("h3", { hasText: titleA })).toBeVisible();
    await expect(page.locator("h3", { hasText: titleB })).toBeVisible();
  });
});
