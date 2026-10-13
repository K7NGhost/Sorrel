<script lang="ts">
  import CodeMirror from "svelte-codemirror-editor";
  import { LanguageSupport, StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
  import { stex } from "@codemirror/legacy-modes/mode/stex";
  import { EditorView } from "@codemirror/view";
  import { autocompletion, completeFromList } from "@codemirror/autocomplete";
  import { tags } from "@lezer/highlight";

  let { value = $bindable(""), disabled, onsave }: { value: string; disabled: boolean; onsave: () => Promise<void> } = $props();

  const language = new LanguageSupport(StreamLanguage.define(stex));
  const theme = EditorView.theme({
    "&": { height: "100%", color: "var(--color-base-content)", backgroundColor: "var(--color-base-100)" },
    ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, monospace", fontSize: "13px", lineHeight: "1.7" },
    ".cm-content": { padding: "12px 0", caretColor: "var(--color-primary)" },
    ".cm-gutters": { backgroundColor: "var(--color-base-200)", color: "var(--color-base-content)", border: "none" },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in oklch, var(--color-primary) 8%, transparent)" },
    ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--color-primary) 18%, transparent)" },
    ".cm-cursor": { borderLeftColor: "var(--color-primary)" },
    ".cm-panels, .cm-tooltip": { backgroundColor: "var(--color-base-200)", color: "var(--color-base-content)" },
    ".cm-selectionMatch": { backgroundColor: "color-mix(in srgb, var(--color-primary) 12%, transparent)" },
    ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--color-warning) 14%, transparent)" },
    ".cm-searchMatch-selected": {
      backgroundColor: "color-mix(in srgb, var(--color-warning) 20%, transparent)",
      outline: "1px solid var(--color-warning)",
      outlineOffset: "-1px",
    },
    ".cm-textfield": {
      backgroundColor: "var(--color-base-100)",
      color: "var(--color-base-content)",
      border: "1px solid var(--color-base-300)",
      borderRadius: "var(--radius-field)",
      "&:focus-visible": { outline: "2px solid var(--color-primary)", outlineOffset: "1px" },
    },
    ".cm-button": {
      backgroundImage: "none",
      backgroundColor: "var(--color-base-300)",
      color: "var(--color-base-content)",
      border: "1px solid var(--color-base-300)",
      borderRadius: "var(--radius-field)",
      "&:active": { backgroundImage: "none", backgroundColor: "var(--color-base-200)" },
      "&:focus-visible": { outline: "2px solid var(--color-primary)", outlineOffset: "1px" },
    },
  });
  const extensions = [
    EditorView.contentAttributes.of({ "aria-label": "LaTeX resume source", "aria-multiline": "true" }),
    syntaxHighlighting(HighlightStyle.define([
      { tag: [tags.keyword, tags.tagName], color: "var(--color-primary)" },
      { tag: tags.comment, color: "color-mix(in oklch, var(--color-base-content) 55%, transparent)" },
      { tag: [tags.string, tags.atom], color: "var(--color-success)" },
      { tag: [tags.number, tags.meta], color: "var(--color-info)" },
      { tag: [tags.bracket, tags.operator], color: "var(--color-accent)" },
    ])),
    autocompletion({ override: [completeFromList([
      { label: "\\section*", type: "keyword", apply: "\\section*{Heading}" },
      { label: "\\textbf", type: "keyword", apply: "\\textbf{Bold text}" },
      { label: "\\textit", type: "keyword", apply: "\\textit{Italic text}" },
      { label: "\\begin", type: "keyword", apply: "\\begin{itemize}\n  \\item Achievement\n\\end{itemize}" },
      { label: "\\item", type: "keyword", apply: "\\item " },
      { label: "\\end", type: "keyword", apply: "\\end{document}" },
    ])] }),
  ];
</script>

<div class="editor-container h-full min-h-0" aria-label="LaTeX editor">
  <CodeMirror bind:value lang={language} {theme} {extensions} editable={!disabled} readonly={disabled} lineWrapping={true} useTab={false} nodebounce={true}
    keybindings={[{ key: "Mod-s", preventDefault: true, run: () => { void onsave(); return true; } }]}
    styles={{ "&": { height: "100%" } }}
  />
</div>

<style>
  .editor-container :global(.codemirror-wrapper) { height: 100%; min-height: 0; }
</style>
