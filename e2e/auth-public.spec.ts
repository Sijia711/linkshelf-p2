import { test, expect } from "@playwright/test";

test.describe("Public Auth Pages and Protection", () => {
  test("login page renders all expected controls and links", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveTitle(/Sign In — LinkShelf/i);
    await expect(page.getByRole("heading", { name: "LinkShelf" })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    const signUpLink = page.getByRole("link", { name: /sign up/i });
    await expect(signUpLink).toBeVisible();
    await signUpLink.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("signup page renders all expected controls and links", async ({ page }) => {
    await page.goto("/signup");

    await expect(page).toHaveTitle(/Create Account — LinkShelf/i);
    await expect(page.getByRole("heading", { name: "LinkShelf" })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/^password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign up/i })).toBeVisible();

    const signInLink = page.getByRole("link", { name: /sign in/i });
    await expect(signInLink).toBeVisible();
    await signInLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user accessing root '/' is redirected to '/login'", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user accessing protected '/dashboard' is redirected to '/login' with return url", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fdashboard/);
  });

  test("client-side validation on login rejects invalid email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email address/i).fill("not-an-email");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Browser HTML5 validation or server redirect check
    // The email input has type="email" and required
    const emailInput = page.getByLabel(/email address/i);
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
  });
});
