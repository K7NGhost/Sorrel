import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.isTauri = true;
    type Folder = { id: string; name: string; parent_id: string | null };
    type Document = { id: string; name: string; stored_name: string; kind: string; size_bytes: number; uploaded_at: string; folder_id: string | null };
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {
      invoke: async (command: string, args: { query?: string; values?: (string | number | null)[]; path?: string; paths?: string[]; fromPath?: string; toPath?: string }) => {
        const folders = JSON.parse(localStorage.getItem("profile-folders") ?? "[]") as Folder[];
        const documents = JSON.parse(localStorage.getItem("profile-documents") ?? "[]") as Document[];
        if (command === "plugin:sql|load") return "sqlite:sorrel.db";
        if (command === "plugin:sql|select") return args.query?.includes("document_folders") ? folders : documents;
        if (command === "plugin:sql|execute") {
          const values = args.values ?? [];
          if (args.query?.startsWith("INSERT INTO document_folders")) {
            const [id, name, parent_id] = values as [string, string, string | null];
            localStorage.setItem("profile-folders", JSON.stringify([...folders, { id, name, parent_id }]));
          } else if (args.query?.startsWith("INSERT INTO documents")) {
            const [id, name, stored_name, kind, size_bytes, uploaded_at, folder_id] = values;
            localStorage.setItem("profile-documents", JSON.stringify([...documents, { id, name, stored_name, kind, size_bytes, uploaded_at, folder_id }]));
          } else if (args.query?.startsWith("UPDATE documents")) {
            const [folder_id, id] = values;
            localStorage.setItem("profile-documents", JSON.stringify(documents.map((document) => document.id === id ? { ...document, folder_id } : document)));
          } else throw new Error(`Unexpected query: ${args.query}`);
          return [1, 0];
        }
        if (command === "plugin:dialog|open") return ["C:/incoming/Resume.pdf"];
        if (command === "plugin:path|resolve_directory") return "C:/AppData/Sorrel";
        if (command === "plugin:path|join") return args.paths!.join("/");
        if (command === "plugin:path|basename") return args.path!.split("/").at(-1);
        if (command === "plugin:fs|mkdir") return;
        if (command === "plugin:fs|stat") return { isFile: true, size: 1024, mtime: null, atime: null, birthtime: null };
        if (command === "plugin:fs|copy_file") {
          localStorage.setItem("profile-copy", JSON.stringify({ from: args.fromPath, to: args.toPath }));
          return;
        }
        if (command === "plugin:opener|reveal_item_in_dir") {
          localStorage.setItem("profile-revealed", JSON.stringify(args.paths));
          return;
        }
        throw new Error(`Unexpected native command: ${command}`);
      },
    } });
  });
});

test("Profile folders accept copied uploads, survive reload, and reveal the saved file", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByRole("textbox", { name: "Folder name", exact: true }).fill("Career");
  await page.getByRole("button", { name: "Create folder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Folder Career", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByRole("textbox", { name: "Folder name", exact: true }).fill("Resumes");
  await page.getByRole("button", { name: "Create folder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Folder Resumes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Upload resume", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resume.pdf", exact: true })).toBeVisible();
  const copy = await page.evaluate(() => JSON.parse(localStorage.getItem("profile-copy")!)) as { from: string; to: string };
  expect(copy.from).toBe("C:/incoming/Resume.pdf");
  expect(copy.to).toMatch(/^C:\/AppData\/Sorrel\/documents\/Resume--[a-f0-9-]+\.pdf$/);
  await page.getByRole("button", { name: "Open file location for Resume.pdf", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("profile-revealed")!))).toEqual([copy.to]);
  await page.reload();
  await page.getByRole("button", { name: "Folder Career", exact: true }).click();
  await page.getByRole("button", { name: "Folder Resumes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resume.pdf", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Move Resume.pdf to folder", exact: true }).selectOption("");
  await expect(page.getByRole("heading", { name: "Resume.pdf", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Folder Documents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resume.pdf", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open file location for Resume.pdf", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("profile-revealed")!))).toEqual([copy.to]);
});

test("Profile folder creation validates duplicate names and search spans folders", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByRole("textbox", { name: "Folder name", exact: true }).fill("Resumes");
  await page.getByRole("button", { name: "Create folder", exact: true }).click();
  await page.getByRole("button", { name: "Upload resume", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resume.pdf", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Folder Documents", exact: true }).click();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByRole("textbox", { name: "Folder name", exact: true }).fill(" resumes ");
  await page.getByRole("button", { name: "Create folder", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search documents" }).fill("Resume");
  await expect(page.getByRole("heading", { name: "Resume.pdf", exact: true })).toBeVisible();
});
