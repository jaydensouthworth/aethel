<script lang="ts">
  import { timeline } from '$lib/stores';

  interface Props {
    open: boolean;
    /** Position on timeline to add the marker */
    position?: number;
    /** Existing marker ID for editing (null for new) */
    markerId?: string | null;
    /** Callback when dialog closes */
    onClose: () => void;
    /** Callback when marker is created/updated */
    onSaved?: (markerId: string) => void;
  }

  let {
    open,
    position = 0,
    markerId = null,
    onClose,
    onSaved,
  }: Props = $props();

  // Form state
  let label = $state('');
  let description = $state('');
  let selectedColor = $state('#3b82f6');

  // Preset colors
  const presetColors = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Cyan', value: '#06b6d4' },
  ];

  // Derived state
  const existingMarker = $derived(markerId ? timeline.getMarker(markerId) : null);
  const isEditing = $derived(!!existingMarker);

  // Load existing marker data when editing
  $effect(() => {
    if (existingMarker) {
      label = existingMarker.label ?? existingMarker.name ?? '';
      description = existingMarker.description ?? '';
      selectedColor = existingMarker.color ?? '#3b82f6';
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!label.trim()) return;

    const id = markerId ?? crypto.randomUUID();

    if (isEditing && markerId) {
      // Update existing marker
      timeline.removeMarker(markerId);
    }

    timeline.addMarker({
      id,
      name: label.trim(),
      label: label.trim(),
      position: existingMarker?.position ?? position,
      description: description.trim() || undefined,
      color: selectedColor,
    });

    onSaved?.(id);
    resetForm();
    onClose();
  }

  function handleDelete() {
    if (markerId) {
      timeline.removeMarker(markerId);
    }
    resetForm();
    onClose();
  }

  function handleCancel() {
    resetForm();
    onClose();
  }

  function resetForm() {
    label = '';
    description = '';
    selectedColor = '#3b82f6';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleCancel();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-backdrop" onclick={handleBackdropClick}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <h2 id="dialog-title" class="dialog-title">
        {isEditing ? 'Edit Marker' : 'Add Marker'}
      </h2>

      <div class="position-info">
        Position: <span class="position-value">{existingMarker?.position ?? position}</span>
      </div>

      <form onsubmit={handleSubmit}>
        <!-- Label input -->
        <div class="form-group">
          <label for="marker-label" class="form-label">Label</label>
          <input
            id="marker-label"
            type="text"
            class="form-input"
            bind:value={label}
            placeholder="e.g., 'Act 2 Begins', 'Midpoint'"
            required
          />
        </div>

        <!-- Description input -->
        <div class="form-group">
          <label for="marker-description" class="form-label">Description (optional)</label>
          <textarea
            id="marker-description"
            class="form-textarea"
            bind:value={description}
            placeholder="Additional notes about this point in the story..."
            rows="3"
          ></textarea>
        </div>

        <!-- Color selection -->
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-grid">
            {#each presetColors as color}
              <button
                type="button"
                class="color-option"
                class:selected={selectedColor === color.value}
                style:--color={color.value}
                onclick={() => selectedColor = color.value}
                title={color.name}
              >
                {#if selectedColor === color.value}
                  <span class="check">✓</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Preview -->
        <div class="preview">
          <div class="preview-label">Preview:</div>
          <div class="marker-preview" style:--marker-color={selectedColor}>
            <div class="marker-flag">🚩</div>
            <span class="marker-text">{label || 'Marker'}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="dialog-actions">
          {#if isEditing}
            <button type="button" class="btn danger" onclick={handleDelete}>
              Delete
            </button>
            <div class="spacer"></div>
          {/if}
          <button type="button" class="btn cancel" onclick={handleCancel}>
            Cancel
          </button>
          <button
            type="submit"
            class="btn confirm"
            disabled={!label.trim()}
            style:--btn-color={selectedColor}
          >
            {isEditing ? 'Save' : 'Add Marker'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .dialog {
    background-color: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    min-width: 380px;
    max-width: 460px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .dialog-title {
    margin: 0 0 var(--space-sm) 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
  }

  .position-info {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin-bottom: var(--space-md);
  }

  .position-value {
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }

  .form-group {
    margin-bottom: var(--space-md);
  }

  .form-label {
    display: block;
    margin-bottom: var(--space-xs);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-size: var(--font-size-base);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background-color: var(--surface-base);
    color: var(--text-primary);
    font-family: inherit;
    transition: border-color var(--transition-fast);
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--color-accent, #3b82f6);
  }

  .form-textarea {
    resize: vertical;
    min-height: 60px;
  }

  .color-grid {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .color-option {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    border: 2px solid transparent;
    background-color: var(--color);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .color-option:hover {
    transform: scale(1.1);
  }

  .color-option.selected {
    border-color: var(--text-primary);
    box-shadow: 0 0 0 2px var(--surface-raised);
  }

  .color-option .check {
    color: white;
    font-size: 14px;
    font-weight: bold;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .preview {
    padding: var(--space-md);
    background-color: var(--surface-sunken);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-md);
  }

  .preview-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-bottom: var(--space-xs);
  }

  .marker-preview {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background-color: color-mix(in srgb, var(--marker-color) 20%, var(--surface-raised));
    border: 1px solid var(--marker-color);
    border-radius: var(--radius-md);
  }

  .marker-flag {
    font-size: var(--font-size-sm);
  }

  .marker-text {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-primary);
  }

  .dialog-actions {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-lg);
  }

  .spacer {
    flex: 1;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn.cancel {
    background-color: transparent;
    border: 1px solid var(--border-default);
    color: var(--text-secondary);
  }

  .btn.cancel:hover {
    background-color: var(--hover-bg);
  }

  .btn.confirm {
    background-color: var(--btn-color, var(--color-accent, #3b82f6));
    border: 1px solid var(--btn-color, var(--color-accent, #3b82f6));
    color: white;
  }

  .btn.confirm:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn.confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn.danger {
    background-color: transparent;
    border: 1px solid #ef4444;
    color: #ef4444;
  }

  .btn.danger:hover {
    background-color: #ef4444;
    color: white;
  }
</style>
