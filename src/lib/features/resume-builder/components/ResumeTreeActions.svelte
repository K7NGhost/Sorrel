<script lang="ts">
  import TreeActions from "$lib/shared/components/TreeActions.svelte";
  import type { ResumeDraft, ResumeFolder, ResumeTreeItem } from "../types";
  let { files, folders, activeFileId, activeTitle, dirty, disabled, onmove, ondelete }: {
    files: ResumeDraft[]; folders: ResumeFolder[]; activeFileId: string; activeTitle: string; dirty: boolean; disabled: boolean;
    onmove: (item: ResumeTreeItem, destination: string | null) => Promise<void>; ondelete: (item: ResumeTreeItem) => Promise<void>;
  } = $props();
  let actions: TreeActions;
  export function open(item: ResumeTreeItem, event: MouseEvent | KeyboardEvent) { actions.open(item, event); }
</script>
<TreeActions bind:this={actions} files={files.map((file) => ({ id: file.id, name: `${file.title}.tex`, folder_id: file.folder_id }))} {folders} {activeFileId} activeName={`${activeTitle}.tex`} {dirty} {disabled} {onmove} {ondelete} />
