import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

test.describe("Protected Authentication Flows", () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, "TEST_USER_EMAIL and TEST_USER_PASSWORD must be configured in environment");

  test("user can log in, view protected dashboard, and log out", async ({ page }) => {
    // 1. Visit login page
    await page.goto("/login");

    // 2. Fill credentials
    await page.getByLabel(/email address/i).fill(TEST_EMAIL!);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD!);

    // 3. Submit login
    await page.getByRole("button", { name: /sign in/i }).click();

    // 4. Verify redirected to dashboard and authenticated user email is displayed
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-email"]')).toContainText(TEST_EMAIL!);
    await expect(page.locator('[data-testid="sign-out-button"]')).toBeVisible();

    // 5. Test sign out
    await page.locator('[data-testid="sign-out-button"]').click();

    // 6. Verify redirected back to login page
    await expect(page).toHaveURL(/\/login/);

    // 7. Attempting to visit /dashboard directly should now redirect back to /login
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fdashboard/);
  });
});
