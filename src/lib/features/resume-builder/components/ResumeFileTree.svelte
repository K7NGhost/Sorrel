<script lang="ts">
  import FileTree from "$lib/shared/components/FileTree.svelte";
  import type { ResumeDraft, ResumeFolder, ResumeTreeItem } from "../types";
  let { files, folders, activeFileId, activeTitle, selectedFolderId, disabled, onopenfile, onselectfolder, oncontext, onmove }: {
    files: ResumeDraft[]; folders: ResumeFolder[]; activeFileId: string; activeTitle: string; selectedFolderId: string | null; disabled: boolean;
    onopenfile: (file: ResumeDraft) => void; onselectfolder: (id: string | null) => void;
    oncontext: (item: ResumeTreeItem, event: MouseEvent | KeyboardEvent) => void;
    onmove: (item: ResumeTreeItem, destination: string | null) => void;
  } = $props();
</script>
<FileTree codeFiles={true} files={files.map((file) => ({ id: file.id, name: `${file.title}.tex`, folder_id: file.folder_id }))} {folders} {activeFileId} activeName={`${activeTitle}.tex`} {selectedFolderId} {disabled} {onselectfolder} {oncontext} {onmove} onopenfile={(file) => { const draft = files.find((draft) => draft.id === file.id); if (draft) onopenfile(draft); }} />
