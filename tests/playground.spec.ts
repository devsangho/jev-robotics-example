import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Keep synthetic test traffic out of the visitor counter.
  await page.route("**/mapmyvisitors.com/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
});

test("episode runs, pauses, completes and exports measured trace", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "From observation to action." }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Step once", exact: true }).click();
  await expect(page.locator(".step-count strong")).toHaveText("001");
  await page.getByLabel("Playback speed").selectOption("2");
  await page.getByRole("button", { name: "Run episode", exact: true }).click();
  await expect(page.getByText("TASK COMPLETE", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Experiments" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export JSON" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/robotics-playground-.*\.json/);
  await page.reload();
  await page.getByRole("button", { name: "Experiments" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("task selection, camera, reset and failed model connection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Environment task").selectOption("object-01");
  await expect(
    page.getByText("Pick up the blue cube and place it in the bowl.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await page.getByRole("button", { name: "Step once", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset episode", exact: true })
    .click();
  await expect(page.locator(".step-count strong")).toHaveText("000");
  await page
    .getByRole("button", { name: "Configure runtime", exact: true })
    .first()
    .click();
  await page.getByLabel("OpenJEV bridge URL").fill("http://127.0.0.1:1");
  await page.getByRole("button", { name: "Connect OpenJEV" }).click();
  await expect(page.getByRole("status")).toContainText("Connection failed");
  await page.getByRole("button", { name: "Close dialog" }).click();
});

test("real bridge response drives selected action and invalid scores stop execution", async ({
  page,
}) => {
  await page.route("http://127.0.0.1:8000/health", (r) =>
    r.fulfill({
      json: { service: "robotics-playground", ready: true, device: "test" },
    }),
  );
  await page.route("http://127.0.0.1:8000/score", (r) =>
    r.fulfill({
      json: { scores: [0.1, 0.2, 0.9, 0.3, 0.1], model: "test fixture" },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Configure runtime", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Connect OpenJEV" }).click();
  await expect(page.getByRole("status")).toContainText("Connected");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Step once", exact: true }).click();
  await expect(page.locator(".candidate.chosen")).toContainText("Lift");
  await expect(page.locator(".step-count strong")).toHaveText("001");
  await page.route("http://127.0.0.1:8000/score", (r) =>
    r.fulfill({ json: { scores: [-5] } }),
  );
  await page.getByRole("button", { name: "Step once", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid model response");
  await expect(page.locator(".step-count strong")).toHaveText("001");
});

test("batch executes distinct seeds and records every episode", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto("/");
  await page.getByLabel("Playback speed").selectOption("2");
  await page.getByRole("button", { name: "Benchmarks", exact: true }).click();
  await page
    .getByRole("button", { name: "Run evaluation", exact: true })
    .click();
  await expect(page.locator(".nav-count")).toHaveText("5", { timeout: 35000 });
  await page.getByRole("button", { name: "Experiments" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  const seeds = await page.locator("tbody .mono").allTextContents();
  expect(new Set(seeds).size).toBe(5);
});

test("mobile layout fits and desktop screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Run episode", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause episode" }),
  ).toBeVisible();
});
