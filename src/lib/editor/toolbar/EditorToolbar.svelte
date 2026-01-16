<script lang="ts">
  import { getEditorContext } from '../EditorContext.svelte';
  import ToolbarButton from './ToolbarButton.svelte';
  import ToolbarGroup from './ToolbarGroup.svelte';
  import Dropdown from '../ui/Dropdown.svelte';
  import DropdownItem from '../ui/DropdownItem.svelte';
  import FontSizeDropdown from './FontSizeDropdown.svelte';
  import HeadingDropdown from './HeadingDropdown.svelte';
  import { DEFAULT_FONTS, TEXT_COLORS, HIGHLIGHT_COLORS } from '../default-fonts';
  import { objects } from '$lib/stores/objects.svelte';
  import { getObjectType } from '$lib/types';

  const ctx = getEditorContext();

  // Local dropdown states
  let showFontMenu = $state(false);
  let showColorMenu = $state(false);
  let showHighlightMenu = $state(false);
  let showRefMenu = $state(false);
  let refSearchQuery = $state('');
  let focusMode = $state(false);

  // Reactive check for active states
  function isActive(name: string | Record<string, unknown>, attrs?: Record<string, unknown>): boolean {
    const editor = ctx.editor;
    if (!editor) return false;
    if (typeof name === 'string') {
      return editor.isActive(name, attrs);
    }
    return editor.isActive(name);
  }

  // Text style actions
  function toggleBold() {
    ctx.editor?.chain().focus().toggleBold().run();
  }

  function toggleItalic() {
    ctx.editor?.chain().focus().toggleItalic().run();
  }

  function toggleUnderline() {
    ctx.editor?.chain().focus().toggleUnderline().run();
  }

  function toggleStrike() {
    ctx.editor?.chain().focus().toggleStrike().run();
  }

  // Alignment
  function setTextAlign(align: 'left' | 'center' | 'right' | 'justify') {
    ctx.editor?.chain().focus().setTextAlign(align).run();
  }

  // Lists
  function toggleBulletList() {
    ctx.editor?.chain().focus().toggleBulletList().run();
  }

  function toggleOrderedList() {
    ctx.editor?.chain().focus().toggleOrderedList().run();
  }

  function toggleBlockquote() {
    ctx.editor?.chain().focus().toggleBlockquote().run();
  }

  // Font
  function setFontFamily(font: string) {
    ctx.editor?.chain().focus().setFontFamily(font).run();
    showFontMenu = false;
  }

  // Colors
  function setColor(color: string | null) {
    if (color) {
      ctx.editor?.chain().focus().setColor(color).run();
    } else {
      ctx.editor?.chain().focus().unsetColor().run();
    }
    showColorMenu = false;
  }

  function setHighlight(color: string | null) {
    if (color) {
      ctx.editor?.chain().focus().setHighlight({ color }).run();
    } else {
      ctx.editor?.chain().focus().unsetHighlight().run();
    }
    showHighlightMenu = false;
  }

  // Link
  function handleLink() {
    if (isActive('link')) {
      ctx.editor?.chain().focus().unsetLink().run();
    } else {
      const url = prompt('Enter URL:');
      if (url) {
        ctx.editor?.chain().focus().setLink({ href: url }).run();
      }
    }
  }

  // Focus mode
  function toggleFocusMode() {
    focusMode = !focusMode;
    ctx.emit('focus:toggle', { enabled: focusMode });
  }

  // Object reference
  const filteredObjects = $derived(() => {
    const query = refSearchQuery.toLowerCase().trim();
    if (!query) return objects.all.slice(0, 10); // Show first 10 when no search
    return objects.all.filter(obj =>
      obj.name.toLowerCase().includes(query) ||
      obj.aliases?.some(a => a.toLowerCase().includes(query))
    ).slice(0, 10);
  });

  function getSelectedText(): string {
    const editor = ctx.editor;
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  }

  function handleCreateRef(objectId: string) {
    const editor = ctx.editor;
    if (!editor) return;

    const { from, to, empty } = editor.state.selection;
    const selectedText = getSelectedText();
    const obj = objects.get(objectId);
    const objType = obj ? getObjectType(obj.typeId) : null;

    // Use selected text as display, or object name if no selection
    const displayText = selectedText || obj?.name || 'Reference';
    const color = obj?.color ?? objType?.color ?? '#3b82f6';

    if (empty) {
      // No selection - just insert at cursor
      editor.chain()
        .focus()
        .insertObjectRef({ objectId, displayText: obj?.name || 'Reference' })
        .run();
    } else {
      // Has selection - replace with ref using selected text
      editor.chain()
        .focus()
        .deleteRange({ from, to })
        .insertObjectRef({ objectId, displayText })
        .run();
    }

    showRefMenu = false;
    refSearchQuery = '';
  }
</script>

<div class="editor-toolbar">
  <!-- Text Style Group -->
  <ToolbarGroup>
    <ToolbarButton
      active={isActive('bold')}
      onclick={toggleBold}
      title="Bold"
      shortcut="Ctrl+B"
    >
      <strong>B</strong>
    </ToolbarButton>
    <ToolbarButton
      active={isActive('italic')}
      onclick={toggleItalic}
      title="Italic"
      shortcut="Ctrl+I"
    >
      <em>I</em>
    </ToolbarButton>
    <ToolbarButton
      active={isActive('underline')}
      onclick={toggleUnderline}
      title="Underline"
      shortcut="Ctrl+U"
    >
      <u>U</u>
    </ToolbarButton>
    <ToolbarButton
      active={isActive('strike')}
      onclick={toggleStrike}
      title="Strikethrough"
    >
      <s>S</s>
    </ToolbarButton>
  </ToolbarGroup>

  <!-- Headings Dropdown -->
  <ToolbarGroup>
    <HeadingDropdown />
  </ToolbarGroup>

  <!-- Font Family Dropdown -->
  <ToolbarGroup divider={false}>
    <Dropdown bind:open={showFontMenu}>
      {#snippet trigger()}
        <ToolbarButton title="Font Family">
          Font
        </ToolbarButton>
      {/snippet}
      {#snippet children()}
        {#each DEFAULT_FONTS as font}
          <DropdownItem onclick={() => setFontFamily(font.value)}>
            <span style:font-family={font.value}>{font.name}</span>
          </DropdownItem>
        {/each}
      {/snippet}
    </Dropdown>
  </ToolbarGroup>

  <!-- Font Size Dropdown -->
  <ToolbarGroup>
    <FontSizeDropdown />
  </ToolbarGroup>

  <!-- Text Color Dropdown -->
  <ToolbarGroup divider={false}>
    <Dropdown bind:open={showColorMenu}>
      {#snippet trigger()}
        <ToolbarButton title="Text Color">
          A
        </ToolbarButton>
      {/snippet}
      {#snippet children()}
        <div class="color-grid">
          {#each TEXT_COLORS as color}
            <button
              class="color-swatch"
              style:background-color={color.value ?? 'transparent'}
              class:no-color={!color.value}
              onclick={() => setColor(color.value)}
              title={color.name}
            ></button>
          {/each}
        </div>
      {/snippet}
    </Dropdown>
  </ToolbarGroup>

  <!-- Highlight Color Dropdown -->
  <ToolbarGroup>
    <Dropdown bind:open={showHighlightMenu}>
      {#snippet trigger()}
        <ToolbarButton title="Highlight">
          H
        </ToolbarButton>
      {/snippet}
      {#snippet children()}
        <div class="color-grid">
          {#each HIGHLIGHT_COLORS as color}
            <button
              class="color-swatch"
              style:background-color={color.value ?? 'transparent'}
              class:no-color={!color.value}
              onclick={() => setHighlight(color.value)}
              title={color.name}
            ></button>
          {/each}
        </div>
      {/snippet}
    </Dropdown>
  </ToolbarGroup>

  <!-- Alignment Group -->
  <ToolbarGroup>
    <ToolbarButton
      active={isActive({ textAlign: 'left' })}
      onclick={() => setTextAlign('left')}
      title="Align Left"
    >
      L
    </ToolbarButton>
    <ToolbarButton
      active={isActive({ textAlign: 'center' })}
      onclick={() => setTextAlign('center')}
      title="Align Center"
    >
      C
    </ToolbarButton>
    <ToolbarButton
      active={isActive({ textAlign: 'right' })}
      onclick={() => setTextAlign('right')}
      title="Align Right"
    >
      R
    </ToolbarButton>
    <ToolbarButton
      active={isActive({ textAlign: 'justify' })}
      onclick={() => setTextAlign('justify')}
      title="Justify"
    >
      J
    </ToolbarButton>
  </ToolbarGroup>

  <!-- Lists Group -->
  <ToolbarGroup>
    <ToolbarButton
      active={isActive('bulletList')}
      onclick={toggleBulletList}
      title="Bullet List"
    >
      UL
    </ToolbarButton>
    <ToolbarButton
      active={isActive('orderedList')}
      onclick={toggleOrderedList}
      title="Numbered List"
    >
      OL
    </ToolbarButton>
    <ToolbarButton
      active={isActive('blockquote')}
      onclick={toggleBlockquote}
      title="Blockquote"
    >
      Q
    </ToolbarButton>
  </ToolbarGroup>

  <!-- Link -->
  <ToolbarGroup>
    <ToolbarButton
      active={isActive('link')}
      onclick={handleLink}
      title="Link"
    >
      Link
    </ToolbarButton>
  </ToolbarGroup>

  <!-- Object Reference -->
  <ToolbarGroup>
    <Dropdown bind:open={showRefMenu}>
      {#snippet trigger()}
        <ToolbarButton title="Link to Object (converts selected text)">
          @Ref
        </ToolbarButton>
      {/snippet}
      {#snippet children()}
        <div class="ref-search">
          <input
            type="text"
            placeholder="Search objects..."
            class="ref-search-input"
            bind:value={refSearchQuery}
          />
        </div>
        <div class="ref-list">
          {#each filteredObjects() as obj}
            <DropdownItem onclick={() => handleCreateRef(obj.id)}>
              <span class="ref-item">
                <span class="ref-icon">{objects.getEffectiveIcon(obj.id)}</span>
                <span class="ref-name">{obj.name}</span>
              </span>
            </DropdownItem>
          {/each}
          {#if filteredObjects().length === 0}
            <div class="ref-empty">No objects found</div>
          {/if}
        </div>
      {/snippet}
    </Dropdown>
  </ToolbarGroup>

  <!-- Focus Mode -->
  <ToolbarGroup divider={false}>
    <ToolbarButton
      active={focusMode}
      onclick={toggleFocusMode}
      title="Focus Mode"
      shortcut="Ctrl+Shift+F"
    >
      Focus
    </ToolbarButton>
  </ToolbarGroup>
</div>

<style>
  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    background-color: var(--surface-raised);
    border-bottom: 1px solid var(--border-subtle);
    flex-wrap: wrap;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
    padding: var(--space-xs);
  }

  .color-swatch {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: transform var(--transition-fast);
  }

  .color-swatch:hover {
    transform: scale(1.1);
  }

  .color-swatch.no-color {
    background: linear-gradient(
      135deg,
      transparent 45%,
      #dc2626 45%,
      #dc2626 55%,
      transparent 55%
    );
  }

  /* Object reference dropdown */
  .ref-search {
    padding: var(--space-xs);
    border-bottom: 1px solid var(--border-subtle);
  }

  .ref-search-input {
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    background-color: var(--surface-base);
    color: var(--text-primary);
  }

  .ref-search-input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .ref-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .ref-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .ref-icon {
    font-size: 1em;
  }

  .ref-name {
    flex: 1;
  }

  .ref-empty {
    padding: var(--space-md);
    text-align: center;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }
</style>
