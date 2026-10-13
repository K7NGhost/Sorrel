export interface TreeFolder { id: string; name: string; parent_id: string | null }
export interface TreeFile { id: string; name: string; folder_id: string | null }
export type TreeItem = { kind: "file" | "folder"; id: string };

export function descendantFolderIds(id: string, folders: TreeFolder[]): Set<string> {
  const descendants = new Set([id]);
  const pending = [id];
  while (pending.length) {
    const parentId = pending.pop();
    for (const folder of folders) if (folder.parent_id === parentId && !descendants.has(folder.id)) {
      descendants.add(folder.id);
      pending.push(folder.id);
    }
  }
  return descendants;
}

export function treeFolderPath(id: string | null, folders: TreeFolder[], root: string): string {
  const names: string[] = [];
  const visited = new Set<string>();
  while (id !== null && !visited.has(id)) {
    visited.add(id);
    const folder = folders.find((entry) => entry.id === id);
    if (!folder) break;
    names.unshift(folder.name);
    id = folder.parent_id;
  }
  return [root, ...names].join(" / ");
}
