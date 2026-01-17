<script lang="ts">
  import { milestones } from '$lib/stores';

  interface Props {
    open: boolean;
    afterIndex: number;
    milestoneId?: string | null;
    onClose: () => void;
  }

  let { open, afterIndex, milestoneId = null, onClose }: Props = $props();

  let name = $state('');
  let description = $state('');
  let selectedColor = $state('#8b5cf6');
  let exportAs = $state<'part' | 'act' | 'section' | 'book'>('act');

  const presetColors = [
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Red', value: '#ef4444' },
  ];

  const existingMilestone = $derived(milestoneId ? milestones.get(milestoneId) : null);
  const isEditing = $derived(!!existingMilestone);

  $effect(() => {
    if (existingMilestone) {
      name = existingMilestone.name;
      description = existingMilestone.description ?? '';
      selectedColor = existingMilestone.color ?? '#8b5cf6';
      exportAs = existingMilestone.exportAs ?? 'act';
    } else if (open) {
      // Reset for new milestone
      name = '';
      description = '';
      selectedColor = '#8b5cf6';
      exportAs = 'act';
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;

    if (isEditing && milestoneId) {
      milestones.update(milestoneId, {
        name: name.trim(),
        description: description.trim() || undefined,
        color: selectedColor,
        exportAs,
      });
    } else {
      milestones.create(name.trim(), afterIndex, {
        color: selectedColor,
        description: description.trim() || undefined,
        exportAs,
      });
    }

    onClose();
  }

  function handleDelete() {
    if (milestoneId) {
      milestones.delete(milestoneId);
    }
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={handleBackdropClick}>
    <div class="dialog" role="dialog" aria-modal="true">
      <h2 class="title">{isEditing ? 'Edit Milestone' : 'Add Milestone'}</h2>
      <p class="subtitle">After card #{afterIndex + 1}</p>

      <form onsubmit={handleSubmit}>
        <div class="field">
          <label for="ms-name">Name</label>
          <input
            id="ms-name"
            type="text"
            bind:value={name}
            placeholder="e.g., Act II, Part 2, Midpoint..."
            required
          />
        </div>

        <div class="field">
          <label for="ms-desc">Description (optional)</label>
          <textarea
            id="ms-desc"
            bind:value={description}
            placeholder="Notes about this section..."
            rows="2"
          ></textarea>
        </div>

        <div class="field">
          <label>Type</label>
          <div class="type-options">
            {#each ['act', 'part', 'section', 'book'] as type}
              <button
                type="button"
                class="type-btn"
                class:selected={exportAs === type}
                onclick={() => exportAs = type as typeof exportAs}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            {/each}
          </div>
        </div>

        <div class="field">
          <label>Color</label>
          <div class="color-row">
            {#each presetColors as c}
              <button
                type="button"
                class="color-btn"
                class:selected={selectedColor === c.value}
                style:--c={c.value}
                onclick={() => selectedColor = c.value}
                title={c.name}
              ></button>
            {/each}
          </div>
        </div>

        <div class="preview">
          <div class="preview-label">Preview</div>
          <div class="preview-badge" style:--pc={selectedColor}>
            {name || 'Milestone'}
          </div>
        </div>

        <div class="actions">
          {#if isEditing}
            <button type="button" class="btn delete" onclick={handleDelete}>Delete</button>
          {/if}
          <div class="spacer"></div>
          <button type="button" class="btn cancel" onclick={onClose}>Cancel</button>
          <button type="submit" class="btn confirm" disabled={!name.trim()} style:--ac={selectedColor}>
            {isEditing ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .dialog {
    background: var(--surface-raised);
    border: 1px solid var(--border-default);
    border-radius: 10px;
    padding: 20px;
    min-width: 340px;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }

  .title {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .subtitle {
    margin: 0 0 16px;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .field {
    margin-bottom: 14px;
  }

  .field label {
    display: block;
    margin-bottom: 5px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .field input,
  .field textarea {
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    border: 1px solid var(--border-default);
    border-radius: 6px;
    background: var(--surface-base);
    color: var(--text-primary);
    font-family: inherit;
  }

  .field input:focus,
  .field textarea:focus {
    outline: none;
    border-color: var(--accent-primary, #3b82f6);
  }

  .field textarea {
    resize: vertical;
    min-height: 48px;
  }

  .type-options {
    display: flex;
    gap: 6px;
  }

  .type-btn {
    flex: 1;
    padding: 6px 8px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--surface-base);
    border: 1px solid var(--border-subtle);
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.12s;
  }

  .type-btn:hover {
    border-color: var(--border-default);
  }

  .type-btn.selected {
    color: var(--accent-primary, #3b82f6);
    border-color: var(--accent-primary, #3b82f6);
    background: color-mix(in srgb, var(--accent-primary, #3b82f6) 10%, var(--surface-base));
  }

  .color-row {
    display: flex;
    gap: 6px;
  }

  .color-btn {
    width: 26px;
    height: 26px;
    border-radius: 5px;
    border: 2px solid transparent;
    background: var(--c);
    cursor: pointer;
    transition: all 0.12s;
  }

  .color-btn:hover {
    transform: scale(1.1);
  }

  .color-btn.selected {
    border-color: var(--text-primary);
    box-shadow: 0 0 0 2px var(--surface-raised);
  }

  .preview {
    padding: 12px;
    background: var(--surface-sunken, var(--surface-base));
    border-radius: 6px;
    margin-bottom: 16px;
  }

  .preview-label {
    font-size: 10px;
    color: var(--text-tertiary);
    margin-bottom: 6px;
  }

  .preview-badge {
    display: inline-flex;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    background: var(--pc);
    border-radius: 10px;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .spacer { flex: 1; }

  .btn {
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.12s;
  }

  .btn.cancel {
    background: transparent;
    border: 1px solid var(--border-default);
    color: var(--text-secondary);
  }

  .btn.cancel:hover {
    background: var(--hover-bg);
  }

  .btn.confirm {
    background: var(--ac);
    border: 1px solid var(--ac);
    color: #fff;
  }

  .btn.confirm:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn.confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn.delete {
    background: transparent;
    border: 1px solid #ef4444;
    color: #ef4444;
  }

  .btn.delete:hover {
    background: #ef4444;
    color: #fff;
  }
</style>
