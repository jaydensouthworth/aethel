<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import TextAlign from '@tiptap/extension-text-align';
  import { TextStyle } from '@tiptap/extension-text-style';
  import FontFamily from '@tiptap/extension-font-family';
  import Color from '@tiptap/extension-color';
  import Highlight from '@tiptap/extension-highlight';
  import Underline from '@tiptap/extension-underline';
  import Link from '@tiptap/extension-link';
  import Placeholder from '@tiptap/extension-placeholder';
  import type { JSONContent } from '@tiptap/core';
  import { DEFAULT_FONT } from './default-fonts';
  import { ObjectRef, FontSize, AutoDetect, autoDetectPluginKey } from './extensions';
  import type { AutoDetectMatch } from './extensions';
  import { createEditorContext, setEditorContext } from './EditorContext.svelte';
  import EditorToolbar from './toolbar/EditorToolbar.svelte';
  import RefContextMenu from './context/RefContextMenu.svelte';
  import MutationMiniEditor from './context/MutationMiniEditor.svelte';
  import ReferenceSyncManager from './ReferenceSyncManager.svelte';
  import AutoSuggestionPopup from './ui/AutoSuggestionPopup.svelte';

  interface Props {
    content?: JSONContent | null;
    onchange?: (content: JSONContent) => void;
    dark?: boolean;
    class?: string;
  }

  let {
    content = $bindable(null),
    onchange,
    dark = false,
    class: className = '',
  }: Props = $props();

  // Create and provide editor context
  const ctx = createEditorContext();
  setEditorContext(ctx);

  let editorElement: HTMLDivElement;
  let focusMode = $state(false);

  // Auto-detect suggestion popup state
  let suggestionPopup = $state({
    open: false,
    matches: [] as AutoDetectMatch[],
    position: { x: 0, y: 0 },
    range: { from: 0, to: 0 },
    typedWord: '',
  });

  function handleAutoDetectAccept(match: AutoDetectMatch, range: { from: number; to: number }, typedWord: string) {
    if (!ctx.editor) return;

    // Replace the word with an ObjectRef node, keeping the typed word as display text
    ctx.editor.chain()
      .focus()
      .deleteRange(range)
      .insertObjectRef({ objectId: match.id, displayText: typedWord })
      .run();

    // Close popup if open
    suggestionPopup.open = false;
  }

  function handleShowPopup(
    matches: AutoDetectMatch[],
    range: { from: number; to: number },
    coords: { x: number; y: number },
    typedWord: string
  ) {
    suggestionPopup = {
      open: true,
      matches,
      position: coords,
      range,
      typedWord,
    };
  }

  function handleClosePopup() {
    suggestionPopup.open = false;
  }

  function handlePopupSelect(match: AutoDetectMatch) {
    handleAutoDetectAccept(match, suggestionPopup.range, suggestionPopup.typedWord);
  }

  // Listen for focus mode toggle
  $effect(() => {
    const unsubscribe = ctx.on('focus:toggle', (data) => {
      focusMode = data.enabled;
    });
    return unsubscribe;
  });

  onMount(() => {
    const editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        TextStyle,
        FontFamily.configure({
          types: ['textStyle'],
        }),
        FontSize.configure({
          types: ['textStyle'],
        }),
        Color.configure({
          types: ['textStyle'],
        }),
        Highlight.configure({
          multicolor: true,
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'editor-link',
          },
        }),
        Placeholder.configure({
          placeholder: 'Start writing...',
        }),
        ObjectRef.configure({
          resolveObject: ctx.resolveObject,
          onRefClick: (objectId) => {
            ctx.emit('ref:click', { objectId, pos: 0 });
            ctx.selectObject(objectId);
          },
          onRefRightClick: (data) => {
            ctx.emit('ref:rightclick', data);
          },
        }),
        AutoDetect.configure({
          getMatches: ctx.getMatchingObjects,
          onAccept: handleAutoDetectAccept,
          onShowPopup: handleShowPopup,
          onDismiss: handleClosePopup,
          debounceMs: 150,
          minWordLength: 2,
        }),
      ],
      content: content ?? {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      },
      editorProps: {
        attributes: {
          class: 'aethel-editor-content',
          style: `font-family: ${DEFAULT_FONT}`,
        },
      },
      onUpdate: ({ editor }) => {
        const json = editor.getJSON();
        content = json;
        onchange?.(json);
        ctx.emit('content:change', {});
      },
      onSelectionUpdate: ({ editor }) => {
        const { from, to, empty } = editor.state.selection;
        ctx.emit('selection:change', { from, to, empty });
      },
    });

    ctx.setEditor(editor);
  });

  onDestroy(() => {
    ctx.editor?.destroy();
    ctx.setEditor(null);
  });

  // Update content when prop changes externally
  $effect(() => {
    if (ctx.editor && content) {
      const currentContent = JSON.stringify(ctx.editor.getJSON());
      const newContent = JSON.stringify(content);
      if (currentContent !== newContent) {
        ctx.editor.commands.setContent(content);
      }
    }
  });
</script>

<div class="editor-wrapper" class:dark class:focus-mode={focusMode} data-theme={dark ? 'dark' : 'light'}>
  <EditorToolbar />
  <div bind:this={editorElement} class="editor-content {className}"></div>
  <RefContextMenu />
  <MutationMiniEditor />
  <ReferenceSyncManager />
  <AutoSuggestionPopup
    open={suggestionPopup.open}
    matches={suggestionPopup.matches}
    position={suggestionPopup.position}
    onSelect={handlePopupSelect}
    onClose={handleClosePopup}
  />
</div>

<style>
  .editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--surface-base);
  }

  /* Editor Content */
  .editor-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg);
  }

  .editor-content :global(.aethel-editor-content) {
    min-height: 100%;
    max-width: 70ch;
    margin: 0 auto;
    font-size: 16px;
    line-height: 1.7;
    color: var(--text-primary);
    outline: none;
  }

  .editor-content :global(.aethel-editor-content p) {
    margin: 0 0 1em 0;
  }

  .editor-content :global(.aethel-editor-content h1) {
    font-size: 2em;
    font-weight: 700;
    margin: 1.5em 0 0.5em 0;
    line-height: 1.2;
  }

  .editor-content :global(.aethel-editor-content h2) {
    font-size: 1.5em;
    font-weight: 600;
    margin: 1.3em 0 0.5em 0;
    line-height: 1.3;
  }

  .editor-content :global(.aethel-editor-content h3) {
    font-size: 1.25em;
    font-weight: 600;
    margin: 1.2em 0 0.5em 0;
    line-height: 1.4;
  }

  .editor-content :global(.aethel-editor-content blockquote) {
    border-left: 3px solid var(--border-default);
    padding-left: var(--space-md);
    margin: 1em 0;
    color: var(--text-secondary);
    font-style: italic;
  }

  .editor-content :global(.aethel-editor-content ul),
  .editor-content :global(.aethel-editor-content ol) {
    margin: 1em 0;
    padding-left: 1.5em;
  }

  .editor-content :global(.aethel-editor-content li) {
    margin: 0.25em 0;
  }

  .editor-content :global(.aethel-editor-content a),
  .editor-content :global(.editor-link) {
    color: var(--accent-color, #3b82f6);
    text-decoration: underline;
    cursor: pointer;
  }

  .editor-content :global(.aethel-editor-content .is-empty::before) {
    content: attr(data-placeholder);
    color: var(--text-muted);
    pointer-events: none;
    float: left;
    height: 0;
  }

  /* Object Reference Nodes */
  .editor-content :global(.object-ref-node) {
    display: inline-flex;
    align-items: center;
    padding: 0.1em 0.5em;
    margin: 0 0.1em;
    border-radius: 4px;
    border: 1px solid;
    font-size: 0.9em;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    vertical-align: baseline;
    text-decoration: none !important;
  }

  .editor-content :global(.object-ref-node:hover) {
    filter: brightness(0.95);
    transform: translateY(-1px);
  }

  .editor-content :global(.object-ref-node[data-status="unknown"]) {
    opacity: 0.7;
  }

  .editor-content :global(.ProseMirror-selectednode .object-ref-node),
  .editor-content :global(.object-ref-node.ProseMirror-selectednode) {
    outline: 2px solid var(--accent-color, #3b82f6);
    outline-offset: 1px;
  }

  /* Auto-detect hint decoration */
  .editor-content :global(.auto-detect-hint) {
    text-decoration: underline dotted var(--accent-color, #3b82f6);
    text-underline-offset: 3px;
    cursor: pointer;
    position: relative;
  }

  .editor-content :global(.auto-detect-hint::after) {
    content: '⏎';
    font-size: 0.65em;
    opacity: 0.5;
    margin-left: 2px;
    vertical-align: super;
  }

  .editor-content :global(.auto-detect-hint:hover) {
    background-color: rgba(59, 130, 246, 0.1);
  }

  /* Dark mode adjustments */
  .editor-wrapper.dark {
    --surface-base: #1a1a1a;
    --surface-raised: #242424;
    --surface-overlay: #2a2a2a;
    --text-primary: #f0f0f0;
    --text-secondary: #a0a0a0;
    --text-muted: #666;
    --border-subtle: #333;
    --hover-bg: rgba(255, 255, 255, 0.08);
    --selected-bg: rgba(255, 255, 255, 0.12);
  }

  /* Focus mode */
  .editor-wrapper.focus-mode {
    background-color: var(--surface-base);
  }

  .editor-wrapper.focus-mode :global(.editor-toolbar) {
    opacity: 0.3;
    transition: opacity 0.2s ease;
  }

  .editor-wrapper.focus-mode :global(.editor-toolbar:hover) {
    opacity: 1;
  }

  .editor-wrapper.focus-mode .editor-content {
    padding: var(--space-xl) var(--space-lg);
  }

  .editor-wrapper.focus-mode .editor-content :global(.aethel-editor-content) {
    max-width: 60ch;
    font-size: 18px;
    line-height: 1.8;
  }
</style>
