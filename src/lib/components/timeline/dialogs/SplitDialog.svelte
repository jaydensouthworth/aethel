<script lang="ts">
  import { timeline, objects } from '$lib/stores';
  import * as ops from '$lib/services/timeline-operations';

  interface Props {
    open: boolean;
    /** Placement ID to split */
    placementId: string | null;
    /** Callback when dialog closes */
    onClose: () => void;
    /** Callback when split is complete */
    onSplit?: (newPlacementIds: string[]) => void;
  }

  let {
    open,
    placementId,
    onClose,
    onSplit,
  }: Props = $props();

  // Form state
  let splitPosition = $state(0);

  // Derived state
  const placement = $derived(placementId ? timeline.getPlacement(placementId) : null);
  const obj = $derived(placement ? objects.get(placement.objectId) : null);
  const hasRange = $derived(placement?.endPosition !== undefined);
  const minPosition = $derived(placement?.position ?? 0);
  const maxPosition = $derived(placement?.endPosition ?? placement?.position ?? 0);
  const rangeLength = $derived(maxPosition - minPosition);

  // Initialize split position to middle of range when opened
  $effect(() => {
    if (open && placement && hasRange) {
      splitPosition = Math.round((minPosition + maxPosition) / 2);
    }
  });

  // Calculate percentages for visual feedback
  const leftPercent = $derived(
    rangeLength > 0 ? ((splitPosition - minPosition) / rangeLength) * 100 : 50
  );
  const rightPercent = $derived(100 - leftPercent);

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!placementId || !placement || !hasRange) return;

    // Validate split position
    if (splitPosition <= minPosition || splitPosition >= maxPosition) {
      return;
    }

    const result = ops.splitPlacement(placementId, splitPosition);
    if (result) {
      onSplit?.([result.before.id, result.after.id]);
    } else {
      onSplit?.([]);
    }
    onClose();
  }

  function handleCancel() {
    onClose();
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

{#if open && placement && obj && hasRange}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-backdrop" onclick={handleBackdropClick}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <h2 id="dialog-title" class="dialog-title">Split Placement</h2>

      <div class="object-info">
        <span class="object-icon" style:color={objects.getEffectiveColor(obj.id)}>
          {objects.getEffectiveIcon(obj.id)}
        </span>
        <span class="object-name">{obj.name}</span>
      </div>

      <form onsubmit={handleSubmit}>
        <!-- Range visualization -->
        <div class="form-group">
          <div class="range-info">
            <span>Start: {minPosition}</span>
            <span>End: {maxPosition}</span>
          </div>

          <div class="range-visualization">
            <div class="range-bar">
              <div
                class="range-left"
                style:width="{leftPercent}%"
              >
                <span class="range-label">{Math.round(leftPercent)}%</span>
              </div>
              <div class="split-marker"></div>
              <div
                class="range-right"
                style:width="{rightPercent}%"
              >
                <span class="range-label">{Math.round(rightPercent)}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Split position input -->
        <div class="form-group">
          <label for="split-position" class="form-label">Split Position</label>
          <div class="input-row">
            <input
              id="split-position"
              type="range"
              class="form-range"
              min={minPosition + 1}
              max={maxPosition - 1}
              bind:value={splitPosition}
            />
            <input
              type="number"
              class="form-input number-input"
              min={minPosition + 1}
              max={maxPosition - 1}
              bind:value={splitPosition}
            />
          </div>
        </div>

        <!-- Result preview -->
        <div class="result-preview">
          <div class="preview-label">Result:</div>
          <div class="preview-items">
            <div class="preview-item" style:--item-color={objects.getEffectiveColor(obj.id)}>
              <span class="item-icon">{objects.getEffectiveIcon(obj.id)}</span>
              <span class="item-name">{obj.name}</span>
              <span class="item-range">{minPosition} - {splitPosition}</span>
            </div>
            <div class="split-arrow">→</div>
            <div class="preview-item" style:--item-color={objects.getEffectiveColor(obj.id)}>
              <span class="item-icon">{objects.getEffectiveIcon(obj.id)}</span>
              <span class="item-name">{obj.name}</span>
              <span class="item-range">{splitPosition} - {maxPosition}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="dialog-actions">
          <button type="button" class="btn cancel" onclick={handleCancel}>
            Cancel
          </button>
          <button
            type="submit"
            class="btn confirm"
            disabled={splitPosition <= minPosition || splitPosition >= maxPosition}
          >
            Split
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
    min-width: 400px;
    max-width: 500px;
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

  .range-info {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-bottom: var(--space-xs);
    font-family: var(--font-mono);
  }

  .range-visualization {
    padding: var(--space-sm);
    background-color: var(--surface-sunken);
    border-radius: var(--radius-md);
  }

  .range-bar {
    display: flex;
    height: 32px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    position: relative;
  }

  .range-left,
  .range-right {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: width var(--transition-fast);
  }

  .range-left {
    background-color: var(--color-accent, #3b82f6);
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  }

  .range-right {
    background-color: color-mix(in srgb, var(--color-accent, #3b82f6) 50%, var(--surface-raised));
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  .range-label {
    font-size: var(--font-size-xs);
    color: white;
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .split-marker {
    width: 3px;
    background-color: var(--surface-raised);
    z-index: 1;
  }

  .input-row {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
  }

  .form-range {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background-color: var(--border-default);
    border-radius: 2px;
    cursor: pointer;
  }

  .form-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background-color: var(--color-accent, #3b82f6);
    border-radius: 50%;
    cursor: pointer;
  }

  .form-input {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--font-size-base);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background-color: var(--surface-base);
    color: var(--text-primary);
    font-family: var(--font-mono);
    transition: border-color var(--transition-fast);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--color-accent, #3b82f6);
  }

  .number-input {
    width: 80px;
    text-align: center;
  }

  .result-preview {
    padding: var(--space-md);
    background-color: var(--surface-sunken);
    border-radius: var(--radius-md);
  }

  .preview-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-bottom: var(--space-sm);
  }

  .preview-items {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .preview-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    border: 2px solid var(--item-color);
    border-radius: var(--radius-md);
    background-color: var(--surface-raised);
    font-size: var(--font-size-xs);
  }

  .item-icon {
    font-size: var(--font-size-sm);
  }

  .item-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .item-range {
    font-family: var(--font-mono);
    color: var(--text-muted);
    font-size: 10px;
  }

  .split-arrow {
    color: var(--text-muted);
    font-size: var(--font-size-lg);
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
