<script lang="ts">
  import type { AethelObject } from '$lib/types';
  import { objects, timeline } from '$lib/stores';
  import * as ops from '$lib/services/timeline-operations';

  interface Props {
    open: boolean;
    /** The object to add a mutation for */
    objectId: string | null;
    /** Position on timeline to add the mutation */
    position?: number;
    /** Track to place mutation on */
    track?: number;
    /** Callback when dialog closes */
    onClose: () => void;
    /** Callback when mutation is added */
    onCreated?: (placementId: string) => void;
  }

  let {
    open,
    objectId,
    position = 0,
    track = 0,
    onClose,
    onCreated,
  }: Props = $props();

  // Form state
  let label = $state('');
  let selectedAttribute = $state('');
  let newValue = $state('');

  // Derived state
  const obj = $derived(objectId ? objects.get(objectId) : null);
  const objectAttributes = $derived(obj?.attributes ?? []);
  const currentState = $derived(objectId ? timeline.getObjectStateAtCursor(objectId) : null);

  // Get list of possible attributes to mutate (existing + custom)
  const availableAttributes = $derived.by(() => {
    const attrs = new Set<string>();
    // Add existing attributes from object
    objectAttributes.forEach(a => attrs.add(a.key));
    // Add common attributes based on object type
    if (obj) {
      switch (obj.typeId) {
        case 'character':
          ['status', 'location', 'mood', 'health', 'inventory'].forEach(a => attrs.add(a));
          break;
        case 'location':
          ['weather', 'time', 'population', 'status'].forEach(a => attrs.add(a));
          break;
        case 'item':
          ['owner', 'location', 'condition', 'status'].forEach(a => attrs.add(a));
          break;
        default:
          ['status', 'notes'].forEach(a => attrs.add(a));
      }
    }
    return Array.from(attrs).sort();
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!objectId || !label.trim()) return;

    // Build changes object
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (selectedAttribute && newValue.trim()) {
      const currentVal = currentState?.computedAttributes[selectedAttribute] ?? null;
      changes[selectedAttribute] = {
        from: currentVal,
        to: newValue.trim(),
      };
    }

    const placement = ops.addMutation(
      objectId,
      position,
      label.trim(),
      changes,
      track
    );

    onCreated?.(placement.id);
    resetForm();
    onClose();
  }

  function handleCancel() {
    resetForm();
    onClose();
  }

  function resetForm() {
    label = '';
    selectedAttribute = '';
    newValue = '';
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

{#if open && obj}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-backdrop" onclick={handleBackdropClick}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <h2 id="dialog-title" class="dialog-title">Add Mutation</h2>

      <div class="object-info">
        <span class="object-icon" style:color={objects.getEffectiveColor(obj.id)}>
          {objects.getEffectiveIcon(obj.id)}
        </span>
        <span class="object-name">{obj.name}</span>
        <span class="position-badge">@ position {position}</span>
      </div>

      <form onsubmit={handleSubmit}>
        <!-- Mutation label -->
        <div class="form-group">
          <label for="mutation-label" class="form-label">Mutation Label</label>
          <input
            id="mutation-label"
            type="text"
            class="form-input"
            bind:value={label}
            placeholder="e.g., 'Character learns the truth', 'Item breaks'"
            required
          />
        </div>

        <!-- Attribute change (optional) -->
        <div class="form-group">
          <label class="form-label">Attribute Change (optional)</label>
          <div class="attribute-row">
            <select
              class="form-select"
              bind:value={selectedAttribute}
            >
              <option value="">Select attribute...</option>
              {#each availableAttributes as attr}
                <option value={attr}>{attr}</option>
              {/each}
              <option value="_custom">+ Custom attribute</option>
            </select>

            {#if selectedAttribute === '_custom'}
              <input
                type="text"
                class="form-input"
                placeholder="Attribute name"
                onchange={(e) => {
                  selectedAttribute = (e.target as HTMLInputElement).value;
                }}
              />
            {/if}
          </div>

          {#if selectedAttribute && selectedAttribute !== '_custom'}
            <div class="value-row">
              {#if currentState?.computedAttributes[selectedAttribute]}
                <div class="current-value">
                  Current: <span class="value">{currentState.computedAttributes[selectedAttribute]}</span>
                </div>
              {/if}
              <input
                type="text"
                class="form-input"
                bind:value={newValue}
                placeholder="New value..."
              />
            </div>
          {/if}
        </div>

        <!-- Existing mutations info -->
        {#if currentState && (currentState.mutations.length > 0 || currentState.futureMutations.length > 0)}
          <div class="mutations-info">
            <div class="info-label">Existing mutations for this object:</div>
            {#if currentState.mutations.length > 0}
              <div class="mutation-list past">
                <span class="list-label">Past ({currentState.mutations.length})</span>
                {#each currentState.mutations.slice(-3) as mutation}
                  <span class="mutation-tag">{mutation.mutation?.label}</span>
                {/each}
              </div>
            {/if}
            {#if currentState.futureMutations.length > 0}
              <div class="mutation-list future">
                <span class="list-label">Future ({currentState.futureMutations.length})</span>
                {#each currentState.futureMutations.slice(0, 3) as mutation}
                  <span class="mutation-tag">{mutation.mutation?.label}</span>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Actions -->
        <div class="dialog-actions">
          <button type="button" class="btn cancel" onclick={handleCancel}>
            Cancel
          </button>
          <button
            type="submit"
            class="btn confirm"
            disabled={!label.trim()}
          >
            Add Mutation
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
    min-width: 420px;
    max-width: 520px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .dialog-title {
    margin: 0 0 var(--space-md) 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
  }

  .object-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background-color: var(--surface-sunken);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-lg);
  }

  .object-icon {
    font-size: var(--font-size-md);
  }

  .object-name {
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
  }

  .position-badge {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-family: var(--font-mono);
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
  .form-select {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-size: var(--font-size-base);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background-color: var(--surface-base);
    color: var(--text-primary);
    transition: border-color var(--transition-fast);
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--color-accent, #3b82f6);
  }

  .attribute-row {
    display: flex;
    gap: var(--space-sm);
  }

  .attribute-row .form-select {
    flex: 1;
  }

  .attribute-row .form-input {
    flex: 1;
  }

  .value-row {
    margin-top: var(--space-sm);
  }

  .current-value {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-bottom: var(--space-xs);
  }

  .current-value .value {
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }

  .mutations-info {
    padding: var(--space-sm) var(--space-md);
    background-color: var(--surface-sunken);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-md);
  }

  .info-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-bottom: var(--space-xs);
  }

  .mutation-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
  }

  .list-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    min-width: 60px;
  }

  .mutation-tag {
    font-size: var(--font-size-xs);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background-color: var(--surface-raised);
    border: 1px dashed var(--border-subtle);
    color: var(--text-secondary);
  }

  .mutation-list.past .mutation-tag {
    opacity: 0.7;
  }

  .dialog-actions {
    display: flex;
    gap: var(--space-sm);
    justify-content: flex-end;
    margin-top: var(--space-lg);
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
    background-color: var(--color-accent, #3b82f6);
    border: 1px solid var(--color-accent, #3b82f6);
    color: white;
  }

  .btn.confirm:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn.confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
