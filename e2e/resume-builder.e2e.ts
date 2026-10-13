import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const pdfBytes = Array.from(readFileSync(new URL("./fixtures/tectonic-resume.pdf", import.meta.url)));
const resume = String.raw`\documentclass{article}
\usepackage{geometry}
\begin{document}
\section*{Jordan Example}
\textbf{Software Engineer}
\end{document}`;

test.beforeEach(async ({ page }) => {
  // Real Tectonic-generated PDF fixture; only the native IPC bridge is replaced.
  await page.addInitScript(({ bytes }) => {
    window.isTauri = true;
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {
      invoke: async (command: string, args: { source?: string; query?: string; values?: (string | null)[] }) => {
        if (command === "compile_resume") {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (args.source?.includes("invalidresumecommand")) throw "Undefined control sequence: invalidresumecommand";
          return { pdf: bytes, diagnostics: "Tectonic compilation completed." };
        }
        if (command === "plugin:sql|load") return "sqlite:sorrel.db";
        if (command === "plugin:sql|select") {
          if (args.query?.includes("resume_folders")) return JSON.parse(localStorage.getItem("test-resume-folders") ?? "[]");
          return JSON.parse(localStorage.getItem("test-resume-files") ?? "[]");
        }
        if (command === "plugin:sql|execute") {
          if (args.query?.includes("INSERT INTO resume_folders")) {
            const [id, name, parent_id] = args.values ?? [];
            const folders = JSON.parse(localStorage.getItem("test-resume-folders") ?? "[]");
            localStorage.setItem("test-resume-folders", JSON.stringify([...folders, { id, name, parent_id }]));
            return [1, 0];
          }
          const [id, title, source, updated_at, folder_id] = args.values ?? [];
          const files = JSON.parse(localStorage.getItem("test-resume-files") ?? "[]") as { id: string }[];
          localStorage.setItem("test-resume-files", JSON.stringify([...files.filter((file) => file.id !== id), { id, title, source, updated_at, folder_id }]));
          return [1, 0];
        }
        if (command === "plugin:dialog|save") return null;
        throw new Error(`Unexpected native command: ${command}`);
      },
    } });
  }, { bytes: pdfBytes });
});

test("CodeMirror compiles and displays the real PDF with zoom controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/resume-builder");
  const editor = page.getByRole("textbox", { name: "LaTeX resume source" });
  await expect(editor).toBeEditable();
  await expect(page.getByLabel("Resume PDF page 1")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Tectonic Resume.*Portfolio/)).toBeAttached();
  await editor.fill(resume);
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PDF", exact: true })).toBeEnabled();
  await page.getByRole("combobox", { name: "PDF zoom" }).selectOption("125");
  await expect(page.getByRole("combobox", { name: "PDF zoom" })).toHaveValue("125");
  expect(errors).toEqual([]);
});

test("compiler errors retain the last PDF and recovered edits survive reload", async ({ page }) => {
  await page.goto("/resume-builder");
  const editor = page.getByRole("textbox", { name: "LaTeX resume source" });
  await expect(page.getByRole("button", { name: "Export PDF", exact: true })).toBeEnabled({ timeout: 15000 });
  await editor.fill("\\invalidresumecommand{Oops}");
  await expect(page.locator(".alert-error")).toContainText("Undefined control sequence");
  await expect(page.getByLabel("Resume PDF page 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PDF", exact: true })).toBeDisabled();
  await editor.fill(resume);
  await expect(page.getByRole("button", { name: "Export PDF", exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByText("Recovered your unsaved edits.", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "LaTeX resume source" })).toContainText("Jordan Example");
});

test("template replacement confirms changes and saving restores the draft", async ({ page }) => {
  await page.goto("/resume-builder");
  const editor = page.getByRole("textbox", { name: "LaTeX resume source" });
  await editor.fill(resume);
  await page.getByRole("button", { name: "Starter template", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editor).toContainText("Jordan Example");
  await page.getByRole("textbox", { name: "Resume name", exact: true }).fill("Jordan CV");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Resume draft saved.", { exact: true })).toBeVisible();
  await expect(editor).toBeEditable();
  await editor.fill(`${resume}\n% Saved update`);
  await editor.press("Control+s");
  await expect(page.getByText("Saved draft", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Resume name", exact: true })).toHaveValue("Jordan CV");
  await expect(page.getByRole("textbox", { name: "LaTeX resume source" })).toContainText("Saved update");
  await expect(page.getByRole("button", { name: "Export PDF", exact: true })).toBeEnabled({ timeout: 15000 });
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await expect(page.locator(".alert-error")).toHaveCount(0);
});

test("browser editing clearly requires the desktop compiler", async ({ page }) => {
  await page.addInitScript(() => { window.isTauri = false; });
  await page.goto("/resume-builder");
  await expect(page.getByRole("textbox", { name: "LaTeX resume source" })).toBeEditable();
  await expect(page.getByText("PDF compilation is available in the desktop app.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PDF", exact: true })).toBeDisabled();
});


test("file explorer keeps separate resumes and saves edits when switching", async ({ page }) => {
  await page.goto("/resume-builder");
  const editor = page.getByRole("textbox", { name: "LaTeX resume source" });
  await expect(editor).toBeEditable();
  await editor.fill(resume);
  await page.getByRole("textbox", { name: "Resume name", exact: true }).fill("Jordan CV");
  await page.getByRole("button", { name: "New .tex", exact: true }).click();
  await expect(page.getByRole("button", { name: "Jordan CV.tex", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Resume name", exact: true })).toHaveValue("Untitled resume");
  await editor.fill(`${resume}\n% Second resume`);
  await page.getByRole("textbox", { name: "Resume name", exact: true }).fill("Technical CV");
  await page.getByRole("button", { name: "Jordan CV.tex", exact: true }).click();
  await expect(editor).not.toContainText("Second resume");
  await expect(page.getByRole("button", { name: "Technical CV.tex", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Technical CV.tex", exact: true }).click();
  await expect(editor).toContainText("Second resume");
  await page.reload();
  await expect(editor).toContainText("Second resume");
  await page.getByRole("button", { name: "Jordan CV.tex", exact: true }).click();
  await expect(editor).toContainText("Jordan Example");
  await expect(editor).not.toContainText("Second resume");
});

test("workspace fills the window and PDF fits its container after resizing", async ({ page }) => {
  await page.goto("/resume-builder");
  const canvas = page.getByLabel("Resume PDF page 1");
  await expect(canvas).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("combobox", { name: "PDF zoom" })).toHaveValue("fit");
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1000, height: 700 }, { width: 640, height: 480 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => page.evaluate(() => {
      const panes = document.querySelector('[data-testid="resume-panes"]')!.getBoundingClientRect();
      const pdfViewport = document.querySelector('[data-testid="pdf-viewport"]')!.getBoundingClientRect();
      const pdf = document.querySelector('canvas[aria-label="Resume PDF page 1"]')!.getBoundingClientRect();
      const editor = document.querySelector('.cm-editor')!.getBoundingClientRect();
      return Math.abs(panes.bottom - innerHeight) < 2 && Math.abs(editor.bottom - panes.bottom) < 2
        && pdf.width <= pdfViewport.width && pdf.height <= pdfViewport.height
        && pdf.width > 0 && pdf.height > 0 && document.documentElement.scrollHeight <= innerHeight;
    })).toBe(true);
  }
  await page.getByRole("button", { name: "Toggle file explorer" }).click();
  await expect(page.getByRole("complementary", { name: "LaTeX files" })).toHaveCount(0);
  await expect.poll(async () => {
    const bounds = await canvas.boundingBox();
    const area = await page.getByTestId("pdf-viewport").boundingBox();
    return !!bounds && !!area && bounds.width <= area.width && bounds.height <= area.height;
  }).toBe(true);
});


test("forks copy latest edits independently and folders organize files across reloads", async ({ page }) => {
  await page.goto("/resume-builder");
  const editor = page.getByRole("textbox", { name: "LaTeX resume source" });
  await editor.fill(`${resume}\n% Original edits`);
  await page.getByRole("textbox", { name: "Resume name", exact: true }).fill("Jordan CV");
  await page.getByRole("button", { name: "Fork", exact: true }).click();
  await expect(page.getByRole("button", { name: "Jordan CV.tex", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Resume name", exact: true })).toHaveValue("Jordan CV (copy)");
  await expect(editor).toContainText("Original edits");
  await editor.fill(`${resume}\n% Fork edits`);
  await page.getByRole("button", { name: "Jordan CV.tex", exact: true }).click();
  await expect(editor).toContainText("Original edits");
  await expect(editor).not.toContainText("Fork edits");
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByRole("textbox", { name: "Folder name", exact: true }).fill("Applications");
  await page.getByRole("button", { name: "Create folder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Folder Applications", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByRole("textbox", { name: "Folder name", exact: true }).fill("Engineering");
  await page.getByRole("button", { name: "Create folder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Folder Engineering", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Move resume to folder" }).selectOption({ label: "Resumes / Applications / Engineering" });
  await expect(page.getByText("Resume moved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Collapse Applications", exact: true }).click();
  await expect(page.getByRole("button", { name: "Jordan CV.tex", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Expand Applications", exact: true }).click();
  await expect(page.getByRole("button", { name: "Jordan CV.tex", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New .tex", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Move resume to folder" }).locator("option:checked")).toHaveText("Resumes / Applications / Engineering");
  await page.reload();
  await expect(page.getByRole("button", { name: "Folder Engineering", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Untitled resume.tex", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Jordan CV (copy).tex", exact: true }).click();
  await expect(editor).toContainText("Fork edits");
  await page.getByRole("combobox", { name: "Move resume to folder" }).selectOption({ label: "Resumes / Applications / Engineering" });
  await page.reload();
  await expect(editor).toContainText("Fork edits");
  await expect(page.getByRole("combobox", { name: "Move resume to folder" }).locator('option:checked')).toHaveText("Resumes / Applications / Engineering");
  await page.getByRole("button", { name: "Jordan CV.tex", exact: true }).click();
  await expect(editor).toContainText("Original edits");
});
