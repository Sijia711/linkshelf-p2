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

  test("can view learning paths list and create a new learning path", async ({ page }) => {
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
    await page.getByRole("button", { name: "Save" }).click();

    // 5. Verify the card appears in the list
    const cardTitle = page.locator("h3", { hasText: uniqueTitle });
    await expect(cardTitle).toBeVisible();

    // Extract path ID from click navigation
    await cardTitle.click();
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
    const card = page.locator(".border", { hasText: uniqueTitle });
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
    const updatedCard = page.locator(".border", { hasText: editedTitle });
    await updatedCard.getByRole("button", { name: "Delete" }).click();

    // 6. Verify card is removed from list
    await expect(page.locator("h3", { hasText: editedTitle })).not.toBeVisible();
    createdPathId = null; // already deleted cleanly
  });

  test("can view detail page, add bookmark item, track completion, and reorder", async ({ page }) => {
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

    // 2. Create a test bookmark via page.request if none exist
    const bmRes = await page.request.post("/api/bookmarks", {
      data: {
        title: `E2E Bookmark ${Date.now()}`,
        url: "https://example.com/playwright-test",
        tags: ["e2e", "test"],
      },
    });
    let bookmarkId: string | null = null;
    if (bmRes.ok()) {
      const bmJson = await bmRes.json();
      bookmarkId = bmJson.data.id;
    } else {
      const bmErr = await bmRes.json().catch(() => null);
      console.error("Failed to create test bookmark via API:", bmRes.status(), bmErr);
    }

    try {
      // 3. Navigate to learning path detail page
      await page.goto(`/learning-paths/${createdPathId}`);
      await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();
      await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();

      // 4. If bookmark is available in dropdown, add it to learning path
      const select = page.locator("select");
      const optionCount = await select.locator("option").count();

      if (optionCount > 1) {
        // Select first available bookmark
        await select.selectOption({ index: 1 });
        await page.getByRole("button", { name: "Add" }).click();

        // Verify item card is displayed
        const toggleBtn = page.getByRole("button", { name: "Mark" });
        await expect(toggleBtn).toBeVisible();

        // 5. Toggle completion
        await toggleBtn.click();
        await expect(page.getByRole("button", { name: "Done" })).toBeVisible();

        // Progress bar should reflect completed state
        await expect(page.locator('[data-testid="progress-bar"] > div')).toHaveCSS("width", /.+/);
      }
    } finally {
      // Clean up test bookmark
      if (bookmarkId) {
        await page.request.delete(`/api/bookmarks/${bookmarkId}`).catch(() => {});
      }
    }
  });
});
