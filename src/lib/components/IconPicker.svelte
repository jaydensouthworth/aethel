<script lang="ts">
  interface Props {
    value: string | undefined;
    inheritedIcon?: string;
    onSelect: (icon: string | undefined) => void;
  }

  let { value, inheritedIcon, onSelect }: Props = $props();

  // Preset icons for different categories
  const presetIcons = [
    // Objects/Items
    '📖', '📝', '📁', '⚔️', '🗡️', '🛡️', '💍', '🔑', '📜', '🗺️',
    // Characters
    '👤', '👥', '🧙', '🧝', '🧛', '👑', '🤴', '👸', '🦸', '🧚',
    // Locations
    '📍', '🏰', '🏠', '⛰️', '🌲', '🌊', '🏝️', '🌆', '🏛️', '⛪',
    // Events/Actions
    '⚡', '🎬', '💥', '🔥', '💀', '❤️', '⭐', '🌙', '☀️', '🌈',
  ];

  let showPicker = $state(false);
  let customIcon = $state('');

  $effect(() => {
    customIcon = value ?? '';
  });

  function handlePresetClick(icon: string) {
    onSelect(icon);
    showPicker = false;
  }

  function handleInherit() {
    onSelect(undefined);
    showPicker = false;
  }

  function handleCustomSubmit() {
    if (customIcon.trim()) {
      onSelect(customIcon.trim());
      showPicker = false;
    }
  }

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    customIcon = target.value;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleCustomSubmit();
    } else if (e.key === 'Escape') {
      showPicker = false;
    }
  }
</script>

<div class="icon-picker">
  <button
    class="icon-swatch"
    class:inherited={!value}
    onclick={() => showPicker = !showPicker}
    title={value ? 'Custom icon' : 'Inherited icon (click to change)'}
  >
    <span class="icon-display">{value ?? inheritedIcon ?? '📁'}</span>
    {#if !value}
      <span class="inherit-indicator">*</span>
    {/if}
  </button>

  {#if showPicker}
    <div class="picker-dropdown">
      <div class="picker-section">
        <span class="picker-label">Presets</span>
        <div class="preset-grid">
          {#each presetIcons as icon}
            <button
              class="preset-swatch"
              class:selected={value === icon}
              onclick={() => handlePresetClick(icon)}
              title="Select {icon}"
            >{icon}</button>
          {/each}
        </div>
      </div>

      <div class="picker-section">
        <span class="picker-label">Custom</span>
        <div class="custom-input">
          <input
            type="text"
            placeholder="Type emoji..."
            value={customIcon}
            oninput={handleInputChange}
            onkeydown={handleKeydown}
          />
          <button class="apply-btn" onclick={handleCustomSubmit}>Apply</button>
        </div>
      </div>

      {#if inheritedIcon}
        <div class="picker-section">
          <button class="inherit-btn" onclick={handleInherit}>
            <span class="inherit-swatch">{inheritedIcon}</span>
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
  .icon-picker {
    position: relative;
    display: inline-block;
  }

  .icon-swatch {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm);
    border: 2px solid var(--border-default);
    background-color: var(--surface-base);
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-swatch:hover {
    border-color: var(--border-strong);
    transform: scale(1.05);
  }

  .icon-swatch.inherited {
    border-style: dashed;
  }

  .icon-display {
    font-size: 20px;
    line-height: 1;
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
    min-width: 280px;
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
    grid-template-columns: repeat(10, 1fr);
    gap: 4px;
  }

  .preset-swatch {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    border: 2px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .preset-swatch:hover {
    background-color: var(--hover-bg);
    transform: scale(1.15);
  }

  .preset-swatch.selected {
    border-color: var(--text-primary);
    background-color: var(--selected-bg);
  }

  .custom-input {
    display: flex;
    gap: var(--space-xs);
  }

  .custom-input input[type="text"] {
    flex: 1;
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background-color: var(--surface-base);
  }

  .apply-btn {
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
    background-color: var(--surface-sunken);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .apply-btn:hover {
    background-color: var(--hover-bg);
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
    font-size: 16px;
  }

  .picker-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }
</style>
