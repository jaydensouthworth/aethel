<script lang="ts">
  interface Props {
    value: string | undefined;
    inheritedColor?: string;
    onSelect: (color: string | undefined) => void;
  }

  let { value, inheritedColor, onSelect }: Props = $props();

  // Preset colors matching object types
  const presetColors = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#22c55e', // green
    '#f59e0b', // amber
    '#ec4899', // pink
    '#ef4444', // red
    '#78716c', // stone
    '#64748b', // slate
    '#1f2937', // gray-dark
  ];

  let showPicker = $state(false);
  let customColor = $state('');

  // Sync customColor with value prop
  $effect(() => {
    customColor = value ?? '';
  });

  function handlePresetClick(color: string) {
    onSelect(color);
    showPicker = false;
  }

  function handleInherit() {
    onSelect(undefined);
    showPicker = false;
  }

  function handleCustomSubmit() {
    if (customColor && /^#[0-9A-Fa-f]{6}$/.test(customColor)) {
      onSelect(customColor);
      showPicker = false;
    }
  }

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    customColor = target.value;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleCustomSubmit();
    } else if (e.key === 'Escape') {
      showPicker = false;
    }
  }
</script>

<div class="color-picker">
  <button
    class="color-swatch"
    style:background-color={value ?? inheritedColor ?? '#78716c'}
    class:inherited={!value}
    onclick={() => showPicker = !showPicker}
    title={value ? 'Custom color' : 'Inherited color (click to change)'}
  >
    {#if !value}
      <span class="inherit-indicator">*</span>
    {/if}
  </button>

  {#if showPicker}
    <div class="picker-dropdown">
      <div class="picker-section">
        <span class="picker-label">Presets</span>
        <div class="preset-grid">
          {#each presetColors as color}
            <button
              class="preset-swatch"
              class:selected={value === color}
              style:background-color={color}
              onclick={() => handlePresetClick(color)}
              title="Select {color}"
            ></button>
          {/each}
        </div>
      </div>

      <div class="picker-section">
        <span class="picker-label">Custom</span>
        <div class="custom-input">
          <input
            type="text"
            placeholder="#000000"
            value={customColor}
            oninput={handleInputChange}
            onkeydown={handleKeydown}
          />
          <input
            type="color"
            value={customColor || '#78716c'}
            oninput={(e) => {
              customColor = (e.target as HTMLInputElement).value;
              onSelect(customColor);
            }}
          />
        </div>
      </div>

      {#if inheritedColor}
        <div class="picker-section">
          <button class="inherit-btn" onclick={handleInherit}>
            <span class="inherit-swatch" style:background-color={inheritedColor}></span>
            Inherit from parent
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if showPicker}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-backdrop" onclick={() => showPicker = false}></div>
{/if}

<style>
  .color-picker {
    position: relative;
    display: inline-block;
  }

  .color-swatch {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: 2px solid var(--border-default);
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
  }

  .color-swatch:hover {
    border-color: var(--border-strong);
    transform: scale(1.05);
  }

  .color-swatch.inherited {
    border-style: dashed;
  }

  .inherit-indicator {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    background-color: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: 50%;
    font-size: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .picker-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    background-color: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
    min-width: 200px;
    z-index: 100;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .picker-section {
    margin-bottom: var(--space-sm);
  }

  .picker-section:last-child {
    margin-bottom: 0;
  }

  .picker-label {
    display: block;
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: var(--space-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }

  .preset-swatch {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: 2px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .preset-swatch:hover {
    transform: scale(1.1);
  }

  .preset-swatch.selected {
    border-color: var(--text-primary);
    box-shadow: 0 0 0 2px var(--surface-raised);
  }

  .custom-input {
    display: flex;
    gap: var(--space-xs);
  }

  .custom-input input[type="text"] {
    flex: 1;
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background-color: var(--surface-base);
  }

  .custom-input input[type="color"] {
    width: 32px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .inherit-btn {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background-color: var(--surface-sunken);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .inherit-btn:hover {
    background-color: var(--hover-bg);
  }

  .inherit-swatch {
    width: 16px;
    height: 16px;
    border-radius: var(--radius-xs);
    border: 1px dashed var(--border-default);
  }

  .picker-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }
</style>
