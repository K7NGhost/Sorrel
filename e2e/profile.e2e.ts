import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.isTauri = true;
    type Folder = { id: string; name: string; parent_id: string | null };
    type Document = { id: string; name: string; stored_name: string; kind: string; size_bytes: number; uploaded_at: string; folder_id: string | null };
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {
      invoke: async (command: string, args: { query?: string; values?: (string | number | null)[]; path?: string; paths?: string[]; fromPath?: string; toPath?: string; oldPath?: string; newPath?: string }) => {
        const folders = JSON.parse(localStorage.getItem("profile-folders") ?? "[]") as Folder[];
        const documents = JSON.parse(localStorage.getItem("profile-documents") ?? "[]") as Document[];
        if (command === "plugin:sql|load") return "sqlite:sorrel.db";
        if (command === "plugin:sql|select") return args.query?.includes("document_folders") ? folders : documents;
        if (command === "plugin:sql|execute") {
          const values = args.values ?? [];
          if (localStorage.getItem("profile-fail-write")) { localStorage.removeItem("profile-fail-write"); throw new Error("Simulated write failure"); }
          if (args.query?.startsWith("INSERT INTO document_folders")) {
            const [id, name, parent_id] = values as [string, string, string | null];
            localStorage.setItem("profile-folders", JSON.stringify([...folders, { id, name, parent_id }]));
          } else if (args.query?.startsWith("INSERT INTO documents")) {
            const [id, name, stored_name, kind, size_bytes, uploaded_at, folder_id] = values;
            localStorage.setItem("profile-documents", JSON.stringify([...documents, { id, name, stored_name, kind, size_bytes, uploaded_at, folder_id }]));
          } else if (args.query?.startsWith("UPDATE documents")) {
            const [folder_id, id] = values;
            localStorage.setItem("profile-documents", JSON.stringify(documents.map((document) => document.id === id ? { ...document, folder_id } : document)));
          } else if (args.query?.startsWith("UPDATE document_folders")) {
            const [parent_id, id] = values;
            localStorage.setItem("profile-folders", JSON.stringify(folders.map((folder) => folder.id === id ? { ...folder, parent_id } : folder)));
          } else if (args.query?.startsWith("DELETE FROM document_folders")) {
            const deleted = new Set([values[0]]);
            let changed = true;
            while (changed) {
              changed = false;
              for (const folder of folders) if (deleted.has(folder.parent_id) && !deleted.has(folder.id)) { deleted.add(folder.id); changed = true; }
            }
            localStorage.setItem("profile-folders", JSON.stringify(folders.filter((folder) => !deleted.has(folder.id))));
            localStorage.setItem("profile-documents", JSON.stringify(documents.filter((document) => !deleted.has(document.folder_id))));
          } else if (args.query?.startsWith("DELETE FROM documents")) {
            localStorage.setItem("profile-documents", JSON.stringify(documents.filter((document) => document.id !== values[0])));
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
          const paths = JSON.parse(localStorage.getItem("profile-file-paths") ?? "[]");
          localStorage.setItem("profile-file-paths", JSON.stringify([...paths, args.toPath]));
          return;
        }
        if (command === "plugin:fs|exists") return JSON.parse(localStorage.getItem("profile-file-paths") ?? "[]").includes(args.path);
        if (command === "plugin:fs|rename") {
          const paths = JSON.parse(localStorage.getItem("profile-file-paths") ?? "[]") as string[];
          localStorage.setItem("profile-file-paths", JSON.stringify(paths.map((path) => path === args.oldPath ? args.newPath : path)));
          return;
        }
        if (command === "plugin:fs|remove") {
          const paths = JSON.parse(localStorage.getItem("profile-file-paths") ?? "[]") as string[];
          localStorage.setItem("profile-file-paths", JSON.stringify(paths.filter((path) => path !== args.path)));
          return;
        }
        if (command === "plugin:opener|open_path") { localStorage.setItem("profile-opened", args.path!); return; }
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
  await expect(page.getByRole("button", { name: "Folder Documents", exact: true })).toHaveAttribute("aria-pressed", "true");
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


async function createProfileFolder(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByRole("textbox", { name: "Folder name", exact: true }).fill(name);
  await page.getByRole("button", { name: "Create folder", exact: true }).click();
  await expect(page.getByRole("button", { name: `Folder ${name}`, exact: true })).toBeVisible();
}

test("Profile file tree selects cards, drags files and folders, and supports context actions", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Upload resume", exact: true }).click();
  const file = page.getByRole("button", { name: "Resume.pdf", exact: true });
  await expect(file).toBeVisible();
  await file.click();
  await expect(page.getByRole("article", { name: "Document Resume.pdf", exact: true })).toHaveClass(/border-primary/);
  await createProfileFolder(page, "Career");
  await page.getByRole("button", { name: "Folder Documents", exact: true }).click();
  await createProfileFolder(page, "Applications");
  await file.dragTo(page.getByRole("button", { name: "Folder Career", exact: true }));
  await expect(page.getByRole("combobox", { name: "Move Resume.pdf to folder" }).locator("option:checked")).toHaveText("Documents / Career");
  await page.getByRole("button", { name: "Folder Career", exact: true }).dragTo(page.getByRole("button", { name: "Folder Applications", exact: true }));
  await file.click();
  await expect(page.getByRole("combobox", { name: "Move Resume.pdf to folder" }).locator("option:checked")).toHaveText("Documents / Applications / Career");
  await file.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open file location", exact: true }).click();
  const copy = await page.evaluate(() => JSON.parse(localStorage.getItem("profile-copy")!)) as { to: string };
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("profile-revealed")!))).toEqual([copy.to]);
  await file.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("profile-opened"))).toBe(copy.to);
  await file.focus();
  await file.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Move...", exact: true }).click();
  await page.getByRole("combobox", { name: "Destination folder" }).selectOption("");
  await page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Move Resume.pdf", exact: true }) }).getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Move Resume.pdf to folder" })).toHaveValue("");
  await page.reload();
  await expect(file).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resume.pdf", exact: true })).toBeVisible();
});

test("Profile tree resize persists and confirmed deletes remove saved copies", async ({ page }) => {
  await page.goto("/profile");
  const handle = page.getByRole("separator", { name: "Resize file tree" });
  await expect(handle).toHaveAttribute("aria-valuenow", "224");
  await handle.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "240");
  await page.reload();
  await expect(handle).toHaveAttribute("aria-valuenow", "240");
  await createProfileFolder(page, "Career");
  await createProfileFolder(page, "Resumes");
  await page.getByRole("button", { name: "Upload resume", exact: true }).click();
  await page.getByRole("button", { name: "Folder Career", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete...", exact: true }).click();
  const confirmation = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Delete Career?", exact: true }) });
  await expect(confirmation).toContainText("1 subfolders, and 1 saved files");
  await expect(confirmation).toContainText("Your original uploaded files are kept");
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume.pdf", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Folder Career", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete...", exact: true }).click();
  await page.evaluate(() => localStorage.setItem("profile-fail-write", "true"));
  await confirmation.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(confirmation.getByRole("alert")).toContainText("Simulated write failure");
  const copy = await page.evaluate(() => JSON.parse(localStorage.getItem("profile-copy")!)) as { to: string };
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("profile-file-paths")!))).toContain(copy.to);
  await confirmation.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: "Folder Career", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resume.pdf", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("profile-file-paths")!))).not.toContain(copy.to);
  await page.reload();
  await expect(page.getByRole("button", { name: "Folder Career", exact: true })).toHaveCount(0);
});
