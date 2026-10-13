<script lang="ts">
  import FileTree from "$lib/shared/components/FileTree.svelte";
  import type { DocumentFolder, SavedDocument } from "../types";
  import type { TreeItem } from "$lib/shared/services/tree";
  let { documents, folders, selectedId, selectedDocumentId, disabled, onselect, onselectfile, oncontext, onmove }: {
    documents: SavedDocument[]; folders: DocumentFolder[]; selectedId: string | null; selectedDocumentId: string; disabled: boolean;
    onselect: (id: string | null) => void; onselectfile: (document: SavedDocument) => void;
    oncontext: (item: TreeItem, event: MouseEvent | KeyboardEvent) => void;
    onmove: (item: TreeItem, destination: string | null) => void;
  } = $props();
</script>
<FileTree files={documents} {folders} activeFileId={selectedDocumentId} activeName={documents.find((document) => document.id === selectedDocumentId)?.name ?? ""} selectedFolderId={selectedId} {disabled} rootLabel="Documents" navLabel="Document files" onselectfolder={onselect} {oncontext} {onmove} onopenfile={(file) => { const document = documents.find((document) => document.id === file.id); if (document) onselectfile(document); }} />
