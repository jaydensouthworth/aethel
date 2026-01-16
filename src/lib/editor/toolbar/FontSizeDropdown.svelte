<script lang="ts">
  import { getEditorContext } from '../EditorContext.svelte';
  import Dropdown from '../ui/Dropdown.svelte';
  import ToolbarButton from './ToolbarButton.svelte';
  import { FONT_SIZES, DEFAULT_FONT_SIZE } from '../default-fonts';

  const ctx = getEditorContext();

  let open = $state(false);
  let showCustomInput = $state(false);
  let customValue = $state(16);

  // Get current font size from editor selection
  const currentSize = $derived(() => {
    const editor = ctx.editor;
    if (!editor) return DEFAULT_FONT_SIZE;
    const attrs = editor.getAttributes('textStyle');
    return attrs?.fontSize ?? DEFAULT_FONT_SIZE;
  });

  // Get display label for button
  const displayLabel = $derived(() => {
    const size = currentSize();
    // Try to find matching preset
    const preset = FONT_SIZES.find((f) => f.value === size);
    if (preset) return preset.name;
    // Show raw value
    return size;
  });

  function setFontSize(size: string) {
    ctx.editor?.chain().focus().setFontSize(size).run();
    open = false;
    showCustomInput = false;
  }

  function handlePresetClick(value: string) {
    setFontSize(value);
  }

  function toggleCustomInput() {
    showCustomInput = !showCustomInput;
    if (showCustomInput) {
      // Parse current size to number
      const current = currentSize();
      customValue = parseInt(current, 10) || 16;
    }
  }

  function applyCustomSize() {
    const size = `${customValue}px`;
    setFontSize(size);
  }

  function handleSliderInput(e: Event) {
    const target = e.target as HTMLInputElement;
    customValue = parseInt(target.value, 10);
  }

  function handleNumberInput(e: Event) {
    const target = e.target as HTMLInputElement;
    customValue = Math.max(8, Math.min(72, parseInt(target.value, 10) || 16));
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      applyCustomSize();
    }
  }
</script>

<Dropdown bind:open>
  {#snippet trigger()}
    <ToolbarButton title="Font Size">
      <span class="size-label">{displayLabel()}</span>
      <span class="dropdown-arrow">&#9662;</span>
    </ToolbarButton>
  {/snippet}

  {#snippet children()}
    <div class="font-size-dropdown">
      <!-- Presets -->
      <div class="presets">
        {#each FONT_SIZES as size}
          <button
            class="preset-item"
            class:active={currentSize() === size.value}
            onclick={() => handlePresetClick(size.value)}
          >
            <span class="preset-name">{size.name}</span>
            <span class="preset-value">{size.value}</span>
          </button>
        {/each}
      </div>

      <!-- Divider -->
      <div class="divider"></div>

      <!-- Custom Size Toggle -->
      <button class="custom-toggle" onclick={toggleCustomInput}>
        <span>Custom size</span>
        <span class="toggle-icon">{showCustomInput ? '−' : '+'}</span>
      </button>

      <!-- Custom Input Panel -->
      {#if showCustomInput}
        <div class="custom-panel">
          <div class="slider-row">
            <input
              type="range"
              min="8"
              max="72"
              step="1"
              value={customValue}
              oninput={handleSliderInput}
              class="size-slider"
            />
          </div>
          <div class="input-row">
            <input
              type="number"
              min="8"
              max="72"
              value={customValue}
              oninput={handleNumberInput}
              onkeydown={handleKeydown}
              class="size-input"
            />
            <span class="unit">px</span>
            <button class="apply-btn" onclick={applyCustomSize}>Apply</button>
          </div>
        </div>
      {/if}
    </div>
  {/snippet}
</Dropdown>

<style>
  .size-label {
    min-width: 40px;
    text-align: left;
    font-size: var(--font-size-sm);
  }

  .dropdown-arrow {
    font-size: 10px;
    margin-left: 4px;
    opacity: 0.6;
  }

  .font-size-dropdown {
    min-width: 180px;
  }

  .presets {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .preset-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .preset-item:hover {
    background-color: var(--hover-bg);
  }

  .preset-item.active {
    background-color: var(--selected-bg);
    font-weight: 500;
  }

  .preset-name {
    font-weight: inherit;
  }

  .preset-value {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .divider {
    height: 1px;
    background-color: var(--border-subtle);
    margin: var(--space-xs) 0;
  }

  .custom-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .custom-toggle:hover {
    background-color: var(--hover-bg);
    color: var(--text-primary);
  }

  .toggle-icon {
    font-weight: 600;
    font-size: 14px;
  }

  .custom-panel {
    padding: var(--space-sm) var(--space-md);
    padding-top: 0;
  }

  .slider-row {
    margin-bottom: var(--space-sm);
  }

  .size-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--border-subtle);
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
  }

  .size-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent-color, #3b82f6);
    cursor: pointer;
    transition: transform var(--transition-fast);
  }

  .size-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .size-input {
    width: 60px;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--surface-base);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    text-align: center;
  }

  .size-input:focus {
    outline: 2px solid var(--focus-ring, #3b82f6);
    outline-offset: -1px;
  }

  .unit {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .apply-btn {
    margin-left: auto;
    padding: var(--space-xs) var(--space-sm);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--accent-color, #3b82f6);
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: opacity var(--transition-fast);
  }

  .apply-btn:hover {
    opacity: 0.9;
  }
</style>
