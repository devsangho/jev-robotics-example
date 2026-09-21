import { test, expect, type Page, type Download } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function json(download: Download) {
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}
test.beforeEach(async ({ page }) => {
  await page.route("**/mapmyvisitors.com/**", (r) =>
    r.fulfill({ body: "", contentType: "application/javascript" }),
  );
});
async function connect(page: Page) {
  await page.route("http://127.0.0.1:8000/health", (r) =>
    r.fulfill({
      json: { service: "robotics-playground", ready: true, device: "fixture" },
    }),
  );
  await page
    .getByRole("button", { name: "Configure runtime", exact: true })
    .click();
  await page.getByText("Advanced: optional AlexWortega Qwen 4B bridge").click();
  await page.getByRole("button", { name: "Connect OpenJEV" }).click();
  await expect(page.getByRole("status")).toContainText("Connected");
  await page.getByRole("button", { name: "Close dialog" }).click();
}
test("A/B uses identical inputs and persists paired real-response traces", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.route("http://127.0.0.1:8000/score", (r) => {
    const p = r.request().postDataJSON().premise as string;
    const phase = p.includes("open gripper is away")
      ? 0
      : p.includes("has not been grasped")
        ? 1
        : p.includes("still at table height")
          ? 2
          : p.includes("away from the destination")
            ? 3
            : 4;
    return r.fulfill({
      json: {
        model: "fixture model",
        scores: [0, 1, 2, 3, 4].map((i) => (i === phase ? 0.96 : 0.01)),
      },
    });
  });
  await page.goto("/");
  await connect(page);
  await page.getByLabel("Playback speed").selectOption("2");
  await page.getByLabel("Comparison model").selectOption("openjev");
  await page.getByRole("button", { name: "Run A/B comparison" }).click();
  await expect(
    page.getByRole("button", { name: "Move object" }),
  ).toBeDisabled();
  await expect(
    page.getByText("A/B comparison complete.", { exact: false }),
  ).toBeVisible({ timeout: 140000 });
  const comparison = page.getByRole("region", { name: "A/B comparison" });
  await expect(comparison.locator("tbody tr")).toHaveCount(2);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    comparison.getByRole("button", { name: "Export pair" }).click(),
  ]);
  const { records } = await json(download);
  expect(records).toHaveLength(2);
  expect(records.every((r: any) => r.success)).toBe(true);
  expect(records[0].seed).toBe(records[1].seed);
  expect(records[0].taskConfig).toEqual(records[1].taskConfig);
  expect(records[0].decisions[0].observation).toEqual(
    records[1].decisions[0].observation,
  );
  expect(
    records.find((r: any) => r.comparisonRole === "model").decisions[0].source,
  ).toBe("fixture model");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "A/B comparison" }).locator("tbody tr"),
  ).toHaveCount(2);
});
test("environment changes, blocked transfer, scene replay and saved observations", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/");
  await page.getByRole("button", { name: "Move object", exact: true }).click();
  await page
    .getByRole("button", { name: "Move destination", exact: true })
    .click();
  await page.getByRole("button", { name: "Add obstacle", exact: true }).click();
  const step = page.getByRole("button", { name: "Step once", exact: true });
  for (let i = 0; i < 4; i++) {
    await step.click();
    await expect(page.locator(".step-count strong")).toHaveText(
      String(i + 1).padStart(3, "0"),
    );
  }
  await expect(
    page.getByText("Transfer path blocked.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".scene-canvas")).toHaveAttribute(
    "data-holding",
    "true",
  );
  await page
    .getByRole("button", { name: "Remove obstacle", exact: true })
    .click();
  await page.getByRole("button", { name: "Run episode", exact: true }).click();
  await expect(page.getByText("TASK COMPLETE", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  const timeline = page.getByRole("region", { name: "Decision timeline" });
  await timeline.getByRole("button", { name: "Inspect timeline" }).click();
  await timeline
    .getByRole("button", { name: "Inspect decision 4", exact: true })
    .click();
  await expect(timeline.locator(".observation-text")).toContainText(
    "Obstacle at 0.18,0.32",
  );
  await expect(timeline.locator("canvas")).toBeVisible();
  const liveSteps = await page.locator(".step-count strong").textContent();
  await timeline
    .getByRole("button", { name: "Play replay", exact: true })
    .click();
  await expect(
    timeline.getByRole("button", { name: "Inspect decision 5", exact: true }),
  ).toHaveAttribute("aria-pressed", "true", { timeout: 5000 });
  await expect(page.locator(".step-count strong")).toHaveText(liveSteps!);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    timeline.getByRole("button", { name: "Export trace" }).click(),
  ]);
  const trace = await json(download);
  expect(trace.decisions[3].world.obstacle).toEqual([0.18, 0.32]);
  expect(trace.decisions[0].task.target).toEqual([0.94, 0.3]);
  await page.reload();
  await page.getByRole("button", { name: "Experiments" }).click();
  await page.getByRole("button", { name: "Inspect run", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect timeline", exact: true })
    .click();
  await expect(page.locator(".replay-scene canvas")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("speed samples exclude warmups, export metadata and cancel without robot motion", async ({
  page,
}) => {
  let requests = 0;
  await page.route("http://127.0.0.1:8000/score", async (r) => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 60));
    await r.fulfill({
      json: {
        model: "fixture speed model",
        scores: [0.9, 0.02, 0.02, 0.03, 0.03],
      },
    });
  });
  await page.goto("/");
  await connect(page);
  await page.getByLabel("Speed samples").selectOption("5");
  await page.getByRole("button", { name: "Measure decision speed" }).click();
  await expect(
    page.getByText("Measurement complete.", { exact: true }),
  ).toBeVisible();
  expect(requests).toBe(7);
  await expect(page.locator(".step-count strong")).toHaveText("000");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export speed results" }).click(),
  ]);
  const data = await json(download);
  expect(data.samplesMs).toHaveLength(5);
  expect(data.warmupMs).toHaveLength(2);
  expect(data.median).toBeGreaterThan(40);
  expect(data.p95).toBe(Math.max(...data.samplesMs));
  expect(data.device.userAgent).toBeTruthy();
  expect(data.source).toBe("fixture speed model");
  await page.route("http://127.0.0.1:8000/score", async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await r.fulfill({ json: { scores: [0.9, 0.02, 0.02, 0.03, 0.03] } });
  });
  await page.getByRole("button", { name: "Measure decision speed" }).click();
  await expect(
    page.getByRole("button", { name: "Step once", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel measurement" }).click();
  await expect(page.getByRole("alert")).toContainText("Measurement cancelled");
  await expect(
    page.getByRole("button", { name: "Export speed results" }),
  ).toHaveCount(0);
});

test("failed comparison keeps baseline without fabricating model results; cancellation stops the queue", async ({
  page,
}) => {
  test.setTimeout(120000);
  let modelCalls = 0;
  await page.route("http://127.0.0.1:8000/score", (r) => {
    modelCalls++;
    return r.fulfill({ json: { scores: [-1] } });
  });
  await page.goto("/");
  await connect(page);
  await page.getByLabel("Comparison model").selectOption("openjev");
  await page.getByLabel("Playback speed").selectOption("2");
  await page.getByRole("button", { name: "Run A/B comparison" }).click();
  await expect(
    page.getByText("Comparison stopped: model error.", { exact: false }),
  ).toBeVisible({ timeout: 60000 });
  expect(modelCalls).toBe(1);
  await expect(
    page
      .getByRole("region", { name: "A/B comparison" })
      .getByText("No completed run"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run A/B comparison" }).click();
  await page.getByRole("button", { name: "Cancel comparison" }).click();
  await expect(
    page.getByText("Comparison cancelled; completed runs remain in history."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run episode", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".step-count strong")).toHaveText("000");
  expect(modelCalls).toBe(1);
});
