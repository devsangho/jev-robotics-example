// Optional real-model smoke test; downloads ~480 MB, never run by the fast CI suite.
import { chromium } from "@playwright/test";
const browser = await chromium.launchPersistentContext(
  process.env.SMOKE_PROFILE || "/tmp/robotics-playground-model-profile",
  {
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
    args: ["--enable-unsafe-webgpu"],
  },
);
try {
  const page = await browser.newPage();
  await page.route("**/mapmyvisitors.com/**", (r) =>
    r.fulfill({ contentType: "application/javascript", body: "" }),
  );
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300));
  });
  await page.goto(process.env.SMOKE_URL || "http://localhost:4173/");
  await page.getByRole("button", { name: "Load Open-Jev · 480 MB" }).click();
  let previous = "";
  const interval = setInterval(async () => {
    try {
      const value = await page.locator(".browser-progress").textContent();
      if (value !== previous) {
        console.log(value);
        previous = value;
      }
    } catch {}
  }, 3000);
  try {
    await page.waitForFunction(
      () =>
        document.querySelector(".step-count strong")?.textContent === "001" ||
        !!document.querySelector(".error-banner"),
      {},
      { timeout: 900000 },
    );
    if (await page.locator(".error-banner").count())
      throw new Error(await page.locator(".error-banner").textContent());
    await page.getByRole("button", { name: "Pause episode" }).click();
    console.log(
      "REAL INFERENCE",
      await page.locator(".candidate.chosen").textContent(),
      await page.locator(".decision-foot").textContent(),
    );
    if (process.env.SMOKE_EXPERIMENTS === "1") {
      await page.getByLabel("Speed samples").selectOption("5");
      await page
        .getByRole("button", { name: "Measure decision speed" })
        .click();
      await page
        .getByText("Measurement complete.", { exact: true })
        .waitFor({ timeout: 180000 });
      console.log(
        "REAL SPEED",
        await page.locator(".speed-result").innerText(),
      );
      await page.getByLabel("Playback speed").selectOption("2");
      await page.getByRole("button", { name: "Run A/B comparison" }).click();
      await page
        .getByText("A/B comparison complete.", { exact: false })
        .waitFor({ timeout: 180000 });
      const pair = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("jev-runs") || "[]").slice(0, 2),
      );
      if (
        pair.length !== 2 ||
        !pair[0].comparisonId ||
        pair[0].comparisonId !== pair[1].comparisonId ||
        pair[0].decisions[0].observation !== pair[1].decisions[0].observation
      ) {
        throw new Error(
          "A/B runs did not share an identical starting observation.",
        );
      }
      console.log(
        "REAL COMPARISON",
        await page
          .getByRole("region", { name: "A/B comparison" })
          .locator("tbody")
          .innerText(),
      );
    }
    await page.screenshot({
      path: "test-results/real-model.png",
      fullPage: true,
    });
  } finally {
    clearInterval(interval);
  }
} finally {
  await browser.close();
}
