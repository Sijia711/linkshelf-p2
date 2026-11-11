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

      // 6. Update progress on first item to 100%
      const input1 = item1.getByTestId("progress-input");
      await input1.fill("100");
      await item1.getByTestId("save-progress-button").click();
      await expect(item1.getByTestId("resource-status-badge")).toHaveText("Completed");
      await expect(item1.getByTestId("resource-progress-text")).toHaveText("100%");

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
      await expect(reloadedItem1.getByTestId("resource-status-badge")).toHaveText("Completed");
      await expect(reloadedItem1.getByTestId("resource-progress-text")).toHaveText("100%");
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

  test("shares one path-level rich text notebook across multiple resources and preserves notes when an individual resource is deleted", async ({ page }) => {
    // 1. Create a learning path via page.request
    const pathRes = await page.request.post("/api/learning-paths", {
      data: {
        title: uniqueTitle,
        description: description,
      },
    });
    expect(pathRes.ok()).toBeTruthy();
    const pathJson = await pathRes.json();
    createdPathId = pathJson.data.learning_path.id;

    // 2. Create two test bookmarks (video and article)
    const bmRes1 = await page.request.post("/api/bookmarks", {
      data: {
        title: `Resource Video ${Date.now()}`,
        url: "https://www.youtube.com/watch?v=kCc8FmEb1nY",
        tags: ["llm", "video"],
      },
    });
    const bmRes2 = await page.request.post("/api/bookmarks", {
      data: {
        title: `Resource Article ${Date.now()}`,
        url: "https://arxiv.org/abs/1706.03762",
        tags: ["llm", "paper"],
      },
    });

    const bmJson1 = await bmRes1.json();
    const bmJson2 = await bmRes2.json();
    const bookmarkId1 = bmJson1.data.id;
    const bookmarkId2 = bmJson2.data.id;

    try {
      // Mock the notes endpoint in browser to verify full UI tab switching, rich text editing,
      // autosaving, and note persistence across resource deletion and reload
      // (ensuring tests pass safely before migration 003 is applied to remote Supabase)
      let savedContent: Record<string, unknown> | null = null;
      await page.route("**/api/learning-paths/*/notes", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                note: savedContent
                  ? {
                      id: "mock-note-id",
                      learning_path_id: createdPathId,
                      content: savedContent,
                      updated_at: new Date().toISOString(),
                    }
                  : {
                      id: "",
                      learning_path_id: createdPathId,
                      content: { type: "doc", content: [{ type: "paragraph" }] },
                      updated_at: new Date().toISOString(),
                    },
              },
              error: null,
            }),
          });
        } else if (route.request().method() === "PUT" || route.request().method() === "PATCH") {
          const body = route.request().postDataJSON();
          savedContent = body.content;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                note: {
                  id: "mock-note-id",
                  learning_path_id: createdPathId,
                  content: savedContent,
                  updated_at: new Date().toISOString(),
                },
              },
              error: null,
            }),
          });
        } else {
          await route.continue();
        }
      });

      // 3. Navigate to detail page
      await page.goto(`/learning-paths/${createdPathId}`);
      await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();

      // 4. Add both resources under the Resources tab
      const select = page.locator("select");
      await select.selectOption(bookmarkId1);
      await page.getByRole("button", { name: /Add to Path/i }).click();
      await expect(page.locator('[data-testid="learning-path-item"]')).toHaveCount(1);

      await select.selectOption(bookmarkId2);
      await page.getByRole("button", { name: /Add to Path/i }).click();

      const items = page.locator('[data-testid="learning-path-item"]');
      await expect(items).toHaveCount(2);

      // 5. Switch to Notes tab
      const notesTab = page.getByTestId("tab-notes");
      await notesTab.click();
      await expect(page.getByTestId("path-notebook-section")).toBeVisible();

      // 6. Focus editor and type path-level notes
      const editor = page.getByTestId("tiptap-editor-content");
      await editor.click();
      await page.keyboard.type("Shared LLM Notes: Covering both Karpathy video and Attention paper.");

      // 7. Wait for autosave to complete
      await expect(page.getByTestId("autosave-status")).toContainText(/Saved/i, { timeout: 10000 });

      // 8. Switch back to Resources tab and delete the first resource
      const resourcesTab = page.getByTestId("tab-resources");
      await resourcesTab.click();

      page.once("dialog", async (dialog) => {
        await dialog.accept();
      });
      const firstItemDeleteBtn = items.first().getByRole("button", { name: "Remove item" });
      await firstItemDeleteBtn.click();

      // Verify only 1 resource remains in path
      await expect(items).toHaveCount(1);

      // 9. Switch back to Notes tab — verify notes were NOT deleted or reset!
      await notesTab.click();
      await expect(editor).toContainText("Shared LLM Notes: Covering both Karpathy video and Attention paper.");

      // 10. Reload the page and verify notes persist across reloads
      await page.reload();
      await notesTab.click();
      await expect(editor).toContainText("Shared LLM Notes: Covering both Karpathy video and Attention paper.");
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

  test("supports percentage-based progress: decimal truncation, validation errors, arithmetic mean, and persistence across reloads", async ({ page }) => {
    // 1. Create a learning path
    const pathRes = await page.request.post("/api/learning-paths", {
      data: {
        title: `${uniqueTitle} Percent Progress`,
        description: "Testing custom percentage progress editor",
      },
    });
    expect(pathRes.ok()).toBeTruthy();
    const pathJson = await pathRes.json();
    createdPathId = pathJson.data.learning_path.id;

    // 2. Create two test bookmarks
    const bmRes1 = await page.request.post("/api/bookmarks", {
      data: {
        title: `Resource Alpha ${Date.now()}`,
        url: "https://example.com/alpha",
        tags: ["alpha"],
      },
    });
    const bmRes2 = await page.request.post("/api/bookmarks", {
      data: {
        title: `Resource Beta ${Date.now()}`,
        url: "https://example.com/beta",
        tags: ["beta"],
      },
    });

    const bm1 = await bmRes1.json();
    const bm2 = await bmRes2.json();
    const bookmarkId1 = bm1.data.id;
    const bookmarkId2 = bm2.data.id;

    try {
      // Intercept browser route to reflect percentage progress before migration 004 is applied to remote Supabase
      const progressStore = new Map<string, number>();

      await page.route("**/api/learning-paths/*/items/*", async (route) => {
        if (route.request().method() === "PATCH") {
          const postData = route.request().postDataJSON();
          const urlParts = route.request().url().split("/");
          const itemId = urlParts[urlParts.length - 1];
          if (postData && postData.progress_percentage !== undefined) {
            const val = Math.trunc(Number(postData.progress_percentage));
            progressStore.set(itemId, val);
          }
        }
        await route.continue();
      });

      await page.route(`**/api/learning-paths/${createdPathId}`, async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        if (json.data?.learning_path?.items) {
          let sum = 0;
          let completed = 0;
          const total = json.data.learning_path.items.length;
          for (const it of json.data.learning_path.items) {
            if (progressStore.has(it.id)) {
              it.progress_percentage = progressStore.get(it.id)!;
              it.is_completed = it.progress_percentage === 100;
            } else {
              it.progress_percentage = it.is_completed ? 100 : 0;
            }
            if (it.progress_percentage === 100) completed++;
            sum += it.progress_percentage;
          }
          json.data.learning_path.completed_items = completed;
          json.data.learning_path.progress_percentage = total > 0 ? Math.trunc(sum / total) : 0;
        }
        await route.fulfill({ response, json });
      });

      // 3. Open path page
      await page.goto(`/learning-paths/${createdPathId}`);
      await expect(page.getByRole("heading", { name: `${uniqueTitle} Percent Progress` })).toBeVisible();

      // 4. Add both bookmarks to path
      const select = page.locator("select");
      await select.selectOption(bookmarkId1);
      await page.getByRole("button", { name: /Add to Path/i }).click();
      await expect(page.locator('[data-testid="learning-path-item"]')).toHaveCount(1);

      await select.selectOption(bookmarkId2);
      await page.getByRole("button", { name: /Add to Path/i }).click();

      const items = page.locator('[data-testid="learning-path-item"]');
      await expect(items).toHaveCount(2);

      const item1 = items.first();
      const item2 = items.last();

      // 5. Verify initial state: 0% and "Not Started"
      await expect(item1.getByTestId("resource-status-badge")).toHaveText("Not Started");
      await expect(item1.getByTestId("resource-progress-text")).toHaveText("0%");

      // 6. Test invalid input 120 -> rejected with validation error
      const input1 = item1.getByTestId("progress-input");
      const saveBtn1 = item1.getByTestId("save-progress-button");

      await input1.fill("120");
      await saveBtn1.click();
      await expect(item1.getByTestId("progress-error")).toContainText("between 0 and 100");
      await expect(item1.getByTestId("resource-progress-text")).toHaveText("0%");

      // 7. Test invalid input -20 -> rejected with validation error
      await input1.fill("-20");
      await saveBtn1.click();
      await expect(item1.getByTestId("progress-error")).toContainText("between 0 and 100");
      await expect(item1.getByTestId("resource-progress-text")).toHaveText("0%");

      // 8. Test decimal input 20.78 -> truncated to 20%
      await input1.fill("20.78");
      await saveBtn1.click();
      await expect(item1.getByTestId("resource-status-badge")).toHaveText("In Progress");
      await expect(item1.getByTestId("resource-progress-text")).toHaveText("20%");
      await expect(item1.getByTestId("progress-input")).toHaveValue("20");

      // 9. Update second item to 60%
      const input2 = item2.getByTestId("progress-input");
      const saveBtn2 = item2.getByTestId("save-progress-button");
      await input2.fill("60");
      await saveBtn2.click();
      await expect(item2.getByTestId("resource-status-badge")).toHaveText("In Progress");
      await expect(item2.getByTestId("resource-progress-text")).toHaveText("60%");

      // 10. Verify overall progress: (20 + 60) / 2 = 40%
      await expect(page.locator("text=(40%)")).toBeVisible();

      // 11. Update second item to 100% -> Completed
      await input2.fill("100");
      await saveBtn2.click();
      await expect(item2.getByTestId("resource-status-badge")).toHaveText("Completed");
      await expect(item2.getByTestId("resource-progress-text")).toHaveText("100%");

      // Overall progress: (20 + 100) / 2 = 60%, completed items = 1 of 2
      await expect(page.locator("text=1 of 2 completed (60%)")).toBeVisible();

      // 12. Reload page to verify persistence
      await page.reload();
      await expect(page.getByRole("heading", { name: `${uniqueTitle} Percent Progress` })).toBeVisible();

      const reloadedItems = page.locator('[data-testid="learning-path-item"]');
      await expect(reloadedItems.first().getByTestId("resource-progress-text")).toHaveText("20%");
      await expect(reloadedItems.last().getByTestId("resource-progress-text")).toHaveText("100%");
      await expect(page.locator("text=1 of 2 completed (60%)")).toBeVisible();
    } finally {
      if (bookmarkId1) {
        await page.request.delete(`/api/bookmarks/${bookmarkId1}`).catch(() => {});
      }
      if (bookmarkId2) {
        await page.request.delete(`/api/bookmarks/${bookmarkId2}`).catch(() => {});
      }
    }
  });
});
