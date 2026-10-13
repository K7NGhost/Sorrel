import { expect, test, type Page } from "@playwright/test";
import type { JobApplication } from "../src/lib/features/applications/types";

declare global {
  interface Window {
    isTauri: boolean;
    __sorrelBoardTest: { applications: JobApplication[]; failNextSave: boolean; saves: number };
  }
}

test.beforeEach(async ({ page }) => {
  // Replace only the native bridge. The real UI, drag library, and frontend services run.
  await page.addInitScript(() => {
    const card = (id: string, company: string, status: "applied" | "rejected" | "accepted", sort_order: number) => ({
      id, company, status, sort_order, role: "Engineer", notes: "Private application notes", job_description: "Initial job description", applied_on: "2026-10-12",
      created_at: "2026-10-12T12:00:00Z", updated_at: "2026-10-12T12:00:00Z",
    });
    window.isTauri = true;
    window.__sorrelBoardTest = {
      applications: JSON.parse(localStorage.getItem("test-job-applications") ?? "null") ?? [card("alpha", "Alpha", "applied", 0), card("beta", "Beta", "applied", 1), card("gamma", "Gamma", "rejected", 0)],
      failNextSave: false,
      saves: 0,
    };
    const extraCards = Math.min(50, Math.max(0, Number(new URL(location.href).searchParams.get("cards")) || 0));
    for (let index = 0; index < extraCards; index += 1) {
      for (const status of ["applied", "rejected", "accepted"] as const) {
        window.__sorrelBoardTest.applications.push(card(`${status}-${index}`, `${status} ${index}`, status, index + 2));
      }
    }
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {
      invoke: async (command: string, args: { query: string; values: (string | number)[] }) => {
        const fixture = window.__sorrelBoardTest;
        if (command === "plugin:sql|load") return "sqlite:sorrel.db";
        if (command === "plugin:sql|select") return structuredClone(fixture.applications).sort((a, b) => a.sort_order - b.sort_order || b.id.localeCompare(a.id));
        if (command === "plugin:sql|execute") {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (fixture.failNextSave) { fixture.failNextSave = false; throw new Error("Simulated SQLite failure"); }
          if (args.query.startsWith("UPDATE applications SET notes")) {
            const [notes, job_description, updated_at, id] = args.values;
            const application = fixture.applications.find((item) => item.id === id)!;
            Object.assign(application, { notes, job_description, updated_at });
            localStorage.setItem("test-job-applications", JSON.stringify(fixture.applications));
            return [1, 0];
          }
          if (args.query.startsWith("INSERT INTO applications")) {
            const [id, company, role, notes, status, applied_on, created_at, updated_at, sort_order, job_description] = args.values;
            fixture.applications.unshift({ id, company, role, notes, status, applied_on, created_at, updated_at, sort_order, job_description } as JobApplication);
            localStorage.setItem("test-job-applications", JSON.stringify(fixture.applications));
            return [1, 0];
          }
          const [id, status, updatedAt, ...order] = args.values;
          if (!args.query.includes("WITH move_data")) throw new Error("Unexpected write query");
          for (const application of fixture.applications) {
            if (!order.includes(application.id)) continue;
            application.status = status as JobApplication["status"];
            application.sort_order = order.indexOf(application.id);
            if (application.id === id) application.updated_at = String(updatedAt);
          }
          fixture.saves += 1;
          return [order.length, 0];
        }
        throw new Error(`Unexpected native command: ${command}`);
      },
    } });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Drag Alpha, Engineer", exact: true })).toBeVisible();
});

async function dragTo(page: Page, company: string, destination: string) {
  const handle = page.getByRole("button", { name: `Drag ${company}, Engineer`, exact: true });
  const zone = page.getByRole("list", { name: `${destination} column`, exact: true });
  const start = await handle.boundingBox();
  const target = await zone.boundingBox();
  if (!start || !target) throw new Error("Missing drag bounds");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2 + 12, { steps: 4 });
  await page.mouse.move(target.x + target.width / 2, target.y + 60, { steps: 25 });
  await expect(zone.locator(".drag-placeholder")).toHaveCount(1);
  await page.mouse.up();
}

test("pointer drag animates into an empty column and saves once", async ({ page }) => {
  const appliedBounds = await page.getByRole("list", { name: "Applied column", exact: true }).boundingBox();
  const acceptedBounds = await page.getByRole("list", { name: "Accepted column", exact: true }).boundingBox();
  expect(Math.abs(appliedBounds!.y - acceptedBounds!.y)).toBeLessThan(2);
  await dragTo(page, "Alpha", "Accepted");
  await expect(page.getByRole("list", { name: "Accepted column", exact: true }).getByRole("heading", { name: "Alpha", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__sorrelBoardTest.saves)).toBe(1);
  await expect(page.locator(".drag-placeholder")).toHaveCount(0);
});

test("failed drag rolls back without duplicating the card", async ({ page }) => {
  await page.evaluate(() => { window.__sorrelBoardTest.failNextSave = true; });
  await dragTo(page, "Alpha", "Accepted");
  await expect(page.locator(".alert-error")).toContainText("returned to its previous position");
  await expect(page.getByRole("list", { name: "Applied column", exact: true }).getByRole("heading", { name: "Alpha", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alpha", exact: true })).toHaveCount(1);
  await expect(page.locator(".drag-placeholder")).toHaveCount(0);
  expect(await page.evaluate(() => window.__sorrelBoardTest.saves)).toBe(0);
});

test("keyboard reordering saves only when dropped", async ({ page }) => {
  await page.getByRole("button", { name: "Drag Alpha, Engineer", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("list", { name: "Applied column", exact: true }).getByRole("heading")).toHaveText(["Beta", "Alpha"]);
  expect(await page.evaluate(() => window.__sorrelBoardTest.saves)).toBe(0);
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => window.__sorrelBoardTest.saves)).toBe(1);
  await expect(page.getByRole("list", { name: "Applied column", exact: true }).getByRole("heading")).toHaveText(["Beta", "Alpha"]);
});

test("filtered drag preserves hidden cards and reduced motion works", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("searchbox", { name: "Search company or role" }).fill("Alpha");
  await dragTo(page, "Alpha", "Rejected");
  await expect.poll(() => page.evaluate(() => window.__sorrelBoardTest.saves)).toBe(1);
  await page.getByRole("searchbox", { name: "Search company or role" }).fill("");
  await expect(page.getByRole("list", { name: "Rejected column", exact: true }).getByRole("heading")).toHaveText(["Alpha", "Gamma"]);
  await expect(page.getByRole("list", { name: "Applied column", exact: true }).getByRole("heading")).toHaveText(["Beta"]);
});

test("keyboard transfer between columns commits once on drop", async ({ page }) => {
  await page.getByRole("button", { name: "Drag Alpha, Engineer", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("list", { name: "Accepted column", exact: true }).focus();
  await expect(page.getByRole("list", { name: "Accepted column", exact: true }).getByRole("heading", { name: "Alpha", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__sorrelBoardTest.saves)).toBe(0);
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => window.__sorrelBoardTest.saves)).toBe(1);
  await expect(page.locator(".drag-placeholder")).toHaveCount(0);
});

test("dropping outside the board restores the card without saving", async ({ page }) => {
  const handle = await page.getByRole("button", { name: "Drag Alpha, Engineer", exact: true }).boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x + handle!.width / 2 + 15, handle!.y + handle!.height / 2 + 15, { steps: 5 });
  await page.mouse.move(800, 80, { steps: 20 });
  await page.mouse.up();
  await expect(page.locator(".drag-placeholder")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Applied column", exact: true }).getByRole("heading")).toHaveText(["Alpha", "Beta"]);
  expect(await page.evaluate(() => window.__sorrelBoardTest.saves)).toBe(0);
  await expect(page.getByRole("searchbox", { name: "Search company or role" })).toBeEnabled();
});

test("long columns scroll independently with fixed headings and draggable scrolled cards", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/?cards=20");
  const applied = page.getByRole("list", { name: "Applied column", exact: true });
  const rejected = page.getByRole("list", { name: "Rejected column", exact: true });
  await expect(applied.getByRole("heading")).toHaveCount(22);
  const headingBefore = await page.getByRole("heading", { name: "Applied", exact: true }).boundingBox();
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(pageHeight).toBeLessThanOrEqual(801);
  const measurements = await applied.evaluate((node) => ({ visible: node.clientHeight, content: node.scrollHeight }));
  expect(measurements.content).toBeGreaterThan(measurements.visible);
  await applied.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect.poll(() => applied.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await rejected.evaluate((node) => node.scrollTop)).toBe(0);
  expect((await page.getByRole("heading", { name: "Applied", exact: true }).boundingBox())!.y).toBe(headingBefore!.y);
  await dragTo(page, "applied 19", "Rejected");
  await expect.poll(() => page.evaluate(() => window.__sorrelBoardTest.saves)).toBe(1);
  await expect(rejected.getByRole("heading", { name: "applied 19", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(801);
  await page.setViewportSize({ width: 640, height: 480 });
  expect(await applied.evaluate((node) => node.clientHeight)).toBeGreaterThan(80);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(481);
});


test("compact cards hide details and right-click opens editable advanced information", async ({ page }) => {
  const card = page.locator('.drag-item[aria-label="Alpha, Engineer"]');
  await expect(card).toContainText("Alpha");
  await expect(card).toContainText("Engineer");
  await expect(card).not.toContainText("Private application notes");
  await expect(card).not.toContainText("Initial job description");
  await expect(card.locator('time')).toHaveAttribute("datetime", "2026-10-12");
  await expect(card).toContainText("Applied Oct 12, 2026");
  await card.click({ button: "right" });
  await expect(page.getByRole("menu", { name: "Job actions" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Advanced information" }).click();
  const dialog = page.getByRole("dialog", { name: "Advanced information" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Date applied", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Notes", exact: true })).toHaveValue("Private application notes");
  const description = "Build Svelte apps.\nRemote role with SQL experience.";
  await dialog.getByRole("textbox", { name: "Job description", exact: true }).fill(description);
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  const detailsButton = page.getByRole("button", { name: "View details for Alpha", exact: true });
  await detailsButton.focus();
  await detailsButton.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Advanced information" })).toBeFocused();
  await page.getByRole("menuitem", { name: "Advanced information" }).press("Enter");
  await expect(dialog.getByRole("textbox", { name: "Job description", exact: true })).toHaveValue(description);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await card.click({ button: "right" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Job actions" })).not.toBeVisible();
});

test("new applications save a pasted job description and failed edits retain the modal", async ({ page }) => {
  await page.getByRole("button", { name: "+ Add application", exact: true }).click();
  const add = page.getByRole("dialog", { name: "Add an application" });
  await add.getByRole("textbox", { name: "Company *", exact: true }).fill("Delta");
  await add.getByRole("textbox", { name: "Role", exact: true }).fill("Designer");
  await add.getByRole("textbox", { name: "Job description", exact: true }).fill("Design accessible interfaces.");
  await add.getByRole("button", { name: "Add application", exact: true }).click();
  await expect(add).not.toBeVisible();
  await page.getByRole("button", { name: "View details for Delta", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Advanced information" });
  await expect(dialog.getByRole("textbox", { name: "Job description", exact: true })).toHaveValue("Design accessible interfaces.");
  await dialog.getByRole("textbox", { name: "Job description", exact: true }).fill("Updated requirements.");
  await page.evaluate(() => window.__sorrelBoardTest.failNextSave = true);
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Job description", exact: true })).toHaveValue("Updated requirements.");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
