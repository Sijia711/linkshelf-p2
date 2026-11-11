import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

test.describe("Learning Paths E2E Flow", () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, "TEST_USER_EMAIL and TEST_USER_PASSWORD must be configured in environment");

  let createdPathId: string | null = null;
  const uniqueTitle = `E2E Test Path ${Date.now()}`;
  const editedTitle = `${uniqueTitle} (Edited)`;
  const description = "Created via Playwright automated E2E testing";

  test.beforeEach(async ({ page }) => {
    // Authenticate user before visiting learning paths
    await page.goto("/login");
    await page.getByLabel(/email address/i).fill(TEST_EMAIL!);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test.afterEach(async ({ page }) => {
    // Self-cleanup: ensure created test path is removed via API using page.request (shares auth session)
    if (createdPathId) {
      try {
        await page.request.delete(`/api/learning-paths/${createdPathId}`);
      } catch {
        // ignore cleanup error if already deleted
      }
      createdPathId = null;
    }
  });

  test("can view learning paths list, create a new learning path without duplicates, and open it", async ({ page }) => {
    // 1. Navigate to /learning-paths
    await page.goto("/learning-paths");
    await expect(page.getByRole("heading", { name: "Learning Paths" })).toBeVisible();

    // 2. Open Create Form
    const newBtn = page.getByRole("button", { name: /\+ New Learning Path/i });
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // 3. Fill form
    await page.getByLabel(/^Title/i).fill(uniqueTitle);
    await page.getByLabel(/Description/i).fill(description);

    // 4. Save
    const saveBtn = page.getByTestId("save-path-button");
    await saveBtn.click();

    // 5. Verify exactly one card appears with this title (no duplicate card creation)
    const matchingCards = page.locator("h3", { hasText: uniqueTitle });
    await expect(matchingCards).toHaveCount(1);

    // 6. Navigate to detail page via the explicit 'Open Path' action
    const card = page.locator(`[data-testid^="learning-path-card-"]`, { hasText: uniqueTitle });
    const openBtn = card.getByTestId("open-path-button");
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    await expect(page).toHaveURL(/\/learning-paths\/[0-9a-fA-F-]+/);
    const urlParts = page.url().split("/");
    createdPathId = urlParts[urlParts.length - 1];
  });

  test("can edit an existing learning path and delete it with cleanup", async ({ page }) => {
    // 1. Create a path directly via page.request (shares authenticated cookies with browser)
    const createRes = await page.request.post("/api/learning-paths", {
      data: {
        title: uniqueTitle,
        description: description,
      },
    });

    if (!createRes.ok()) {
      const errBody = await createRes.json().catch(() => null);
      console.error("Failed to create learning path via API:", createRes.status(), errBody);
    }
    expect(createRes.ok()).toBeTruthy();
    const createJson = await createRes.json();
    createdPathId = createJson.data.learning_path.id;

    // 2. Navigate to /learning-paths
    await page.goto("/learning-paths");
    await expect(page.locator("h3", { hasText: uniqueTitle })).toBeVisible();

    // 3. Edit title
    const card = page.locator(`[data-testid="learning-path-card-${createdPathId}"]`);
    await card.getByRole("button", { name: "Edit" }).click();

    const titleInput = page.getByLabel(/^Title/i);
    await titleInput.fill(editedTitle);
    await page.getByRole("button", { name: "Save" }).click();

    // 4. Verify updated title appears
    await expect(page.locator("h3", { hasText: editedTitle })).toBeVisible();

    // 5. Delete path with browser confirmation dialog
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    const updatedCard = page.locator(`[data-testid="learning-path-card-${createdPathId}"]`);
    await updatedCard.getByRole("button", { name: "Delete" }).click();

    // 6. Verify card is removed from list
    await expect(page.locator("h3", { hasText: editedTitle })).not.toBeVisible();
    createdPathId = null; // already deleted cleanly
  });

  test("can view detail page, add YouTube video tutorial bookmark, verify safe link, track progress, reorder, and persist after reload", async ({ page }) => {
    // 1. Create a learning path via page.request
    const pathRes = await page.request.post("/api/learning-paths", {
      data: {
        title: uniqueTitle,
        description: description,
      },
    });

    if (!pathRes.ok()) {
      const errBody = await pathRes.json().catch(() => null);
      console.error("Failed to create learning path via API:", pathRes.status(), errBody);
    }
    expect(pathRes.ok()).toBeTruthy();
    const pathJson = await pathRes.json();
    createdPathId = pathJson.data.learning_path.id;

    // 2. Create two test bookmarks (representing a YouTube video and tutorial) via page.request
    const tutorialUrl1 = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const tutorialTitle1 = `YouTube Tutorial ${Date.now()}`;
    const bmRes1 = await page.request.post("/api/bookmarks", {
      data: {
        title: tutorialTitle1,
        url: tutorialUrl1,
        tags: ["video", "youtube", "tutorial"],
      },
    });

    const tutorialUrl2 = "https://nextjs.org/docs/app";
    const tutorialTitle2 = `Next.js Docs ${Date.now()}`;
    const bmRes2 = await page.request.post("/api/bookmarks", {
      data: {
        title: tutorialTitle2,
        url: tutorialUrl2,
        tags: ["nextjs", "docs"],
      },
    });

    let bookmarkId1: string | null = null;
    let bookmarkId2: string | null = null;

    if (bmRes1.ok()) {
      const bmJson1 = await bmRes1.json();
      bookmarkId1 = bmJson1.data.id;
    }
    if (bmRes2.ok()) {
      const bmJson2 = await bmRes2.json();
      bookmarkId2 = bmJson2.data.id;
    }

    try {
      // 3. Navigate to learning path detail page
      await page.goto(`/learning-paths/${createdPathId}`);
      await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();
      await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();

      // 4. Add the first bookmark (YouTube video) via the dropdown
      const select = page.locator("select");
      await select.selectOption(bookmarkId1!);
      await page.getByRole("button", { name: /Add to Path/i }).click();

      // Verify the item card appears with correct attributes
      const item1 = page.locator('[data-testid="learning-path-item"]', { hasText: tutorialTitle1 });
      await expect(item1).toBeVisible();

      // Verify domain context is shown
      await expect(item1).toContainText("youtube.com");

      // Verify resource title link and explicit 'Open Resource ↗' link have safe attributes
      const titleLink = item1.getByTestId("resource-title-link");
      await expect(titleLink).toHaveAttribute("href", tutorialUrl1);
      await expect(titleLink).toHaveAttribute("target", "_blank");
      await expect(titleLink).toHaveAttribute("rel", "noopener noreferrer");

      const openResourceLink = item1.getByTestId("open-resource-link");
      await expect(openResourceLink).toHaveAttribute("href", tutorialUrl1);
      await expect(openResourceLink).toHaveAttribute("target", "_blank");
      await expect(openResourceLink).toHaveAttribute("rel", "noopener noreferrer");

      // 5. Add second bookmark
      await select.selectOption(bookmarkId2!);
      await page.getByRole("button", { name: /Add to Path/i }).click();

      const item2 = page.locator('[data-testid="learning-path-item"]', { hasText: tutorialTitle2 });
      await expect(item2).toBeVisible();

      // 6. Toggle completion on first item
      const toggleBtn1 = item1.getByTestId("toggle-completion-button");
      await expect(toggleBtn1).toHaveText("Mark");
      await toggleBtn1.click();
      await expect(toggleBtn1).toHaveText("Done");

      // Progress bar reflects completion
      await expect(page.locator('[data-testid="progress-bar"] > div')).toHaveCSS("width", /.+/);

      // 7. Reorder: move the second item up
      const moveUpBtn2 = item2.getByRole("button", { name: "Move item up" });
      await moveUpBtn2.click();

      // Wait for UI to reflect reordered items before reloading
      const items = page.locator('[data-testid="learning-path-item"]');
      await expect(items.first()).toContainText(tutorialTitle2);

      // 8. Reload page to verify persistence across reloads
      await page.reload();
      await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();

      // Verify items persist
      const reloadedItems = page.locator('[data-testid="learning-path-item"]');
      await expect(reloadedItems).toHaveCount(2);

      // Verify first item is now the second tutorial (moved up)
      await expect(reloadedItems.first()).toContainText(tutorialTitle2);

      // Verify completion state persisted
      const reloadedItem1 = page.locator('[data-testid="learning-path-item"]', { hasText: tutorialTitle1 });
      await expect(reloadedItem1.getByTestId("toggle-completion-button")).toHaveText("Done");
    } finally {
      // Clean up test bookmarks
      if (bookmarkId1) {
        await page.request.delete(`/api/bookmarks/${bookmarkId1}`).catch(() => {});
      }
      if (bookmarkId2) {
        await page.request.delete(`/api/bookmarks/${bookmarkId2}`).catch(() => {});
      }
    }
  });
});
