<script lang="ts">
  import { getEditorContext } from '../EditorContext.svelte';
  import Dropdown from '../ui/Dropdown.svelte';
  import ToolbarButton from './ToolbarButton.svelte';

  const ctx = getEditorContext();

  let open = $state(false);

  interface HeadingOption {
    name: string;
    level: 0 | 1 | 2 | 3; // 0 = paragraph
    fontSize: string;
    fontWeight: string;
  }

  const headingOptions: HeadingOption[] = [
    { name: 'Heading 1', level: 1, fontSize: '2em', fontWeight: '700' },
    { name: 'Heading 2', level: 2, fontSize: '1.5em', fontWeight: '600' },
    { name: 'Heading 3', level: 3, fontSize: '1.25em', fontWeight: '600' },
    { name: 'Paragraph', level: 0, fontSize: '1em', fontWeight: '400' },
  ];

  // Get current heading level
  const currentLevel = $derived(() => {
    const editor = ctx.editor;
    if (!editor) return 0;
    if (editor.isActive('heading', { level: 1 })) return 1;
    if (editor.isActive('heading', { level: 2 })) return 2;
    if (editor.isActive('heading', { level: 3 })) return 3;
    return 0;
  });

  // Get display label for button
  const displayLabel = $derived(() => {
    const level = currentLevel();
    if (level === 0) return 'Paragraph';
    return `Heading ${level}`;
  });

  // Get short label for compact display
  const shortLabel = $derived(() => {
    const level = currentLevel();
    if (level === 0) return 'P';
    return `H${level}`;
  });

  function setHeading(level: 0 | 1 | 2 | 3) {
    if (level === 0) {
      ctx.editor?.chain().focus().setParagraph().run();
    } else {
      ctx.editor?.chain().focus().toggleHeading({ level }).run();
    }
    open = false;
  }

  function isActive(level: 0 | 1 | 2 | 3): boolean {
    return currentLevel() === level;
  }
</script>

<Dropdown bind:open>
  {#snippet trigger()}
    <ToolbarButton title="Text style">
      <span class="heading-label">{shortLabel()}</span>
      <span class="dropdown-arrow">&#9662;</span>
    </ToolbarButton>
  {/snippet}

  {#snippet children()}
    <div class="heading-dropdown">
      {#each headingOptions as option}
        <button
          class="heading-item"
          class:active={isActive(option.level)}
          onclick={() => setHeading(option.level)}
        >
          <span
            class="heading-preview"
            style:font-size={option.fontSize}
            style:font-weight={option.fontWeight}
          >
            {option.name}
          </span>
          {#if isActive(option.level)}
            <span class="check-icon">&#10003;</span>
          {/if}
        </button>
      {/each}
    </div>
  {/snippet}
</Dropdown>

<style>
  .heading-label {
    min-width: 24px;
    font-weight: 600;
    font-size: var(--font-size-sm);
  }

  .dropdown-arrow {
    font-size: 10px;
    margin-left: 4px;
    opacity: 0.6;
  }

  .heading-dropdown {
    min-width: 200px;
  }

  .heading-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    transition: background-color var(--transition-fast);
    text-align: left;
  }

  .heading-item:hover {
    background-color: var(--hover-bg);
  }

  .heading-item.active {
    background-color: var(--selected-bg);
  }

  .heading-preview {
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .check-icon {
    color: var(--accent-color, #3b82f6);
    font-size: var(--font-size-sm);
    margin-left: var(--space-sm);
  }
</style>
