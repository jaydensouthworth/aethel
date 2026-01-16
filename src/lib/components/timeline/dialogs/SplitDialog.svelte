<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import type { JSONContent } from '@tiptap/core';
  import { ObjectRef } from '$lib/editor/extensions';
  import { timeline, objects, timelineEditor, timelineHistory } from '$lib/stores';
  import { createObject, createPlacement, getObjectType } from '$lib/types';
  import {
    createAddObjectCommand,
    createAddPlacementCommand,
    createUpdateObjectCommand,
    createUpdatePlacementCommand,
  } from '$lib/services/timeline-commands';
  import * as ops from '$lib/services/timeline-operations';

  interface Props {
    open: boolean;
    /** Placement ID to split */
    placementId: string | null;
    /** Optional initial split position on the timeline */
    splitPosition?: number | null;
    /** Callback when dialog closes */
    onClose: () => void;
    /** Callback when split is complete */
    onSplit?: (newPlacementIds: string[]) => void;
  }

  let {
    open,
    placementId,
    splitPosition: splitPositionHint = null,
    onClose,
    onSplit,
  }: Props = $props();

  // Form state
  let splitPosition = $state(0);
  let splitTextPosition = $state(0);

  // TipTap editor for text splitting
  let editor = $state<Editor | null>(null);
  let editorElement = $state<HTMLDivElement | null>(null);

  // Derived state
  const placement = $derived(placementId ? timeline.getPlacement(placementId) : null);
  const obj = $derived(placement ? objects.get(placement.objectId) : null);
  const objectType = $derived(obj ? getObjectType(obj.typeId) : null);
  const isContentType = $derived(objectType?.isContentType ?? false);
  const hasRange = $derived(placement?.endPosition !== undefined);
  const minPosition = $derived(placement?.position ?? 0);
  const maxPosition = $derived(placement?.endPosition ?? placement?.position ?? 0);
  const rangeLength = $derived(maxPosition - minPosition);

  // Initialize split position when opened
  $effect(() => {
    if (open && placement && hasRange) {
      const fallback = Math.round((minPosition + maxPosition) / 2);
      const desired = splitPositionHint ?? fallback;
      splitPosition = Math.min(Math.max(desired, minPosition + 1), maxPosition - 1);
    }
  });

  // Calculate percentages for visual feedback
  const leftPercent = $derived(
    rangeLength > 0 ? ((splitPosition - minPosition) / rangeLength) * 100 : 50
  );
  const rightPercent = $derived(100 - leftPercent);

  const textSplitBounds = $derived.by(() => {
    if (!editor) return { min: 0, max: 0 };
    const max = editor.state.doc.content.size;
    return { min: 1, max: Math.max(1, max - 1) };
  });

  const canSplitText = $derived.by(() => {
    if (!editor) return false;
    const max = editor.state.doc.content.size;
    return splitTextPosition > 1 && splitTextPosition < max - 1;
  });

  const canSplitTimeline = $derived(
    splitPosition > minPosition && splitPosition < maxPosition
  );

  const canSubmit = $derived(
    hasRange && canSplitTimeline && (!isContentType || canSplitText)
  );

  function createSplitObject(originalContent: JSONContent): ReturnType<typeof createObject> {
    if (!obj || !placement) {
      throw new Error('Missing object or placement for split');
    }

    const newObj = createObject(`${obj.name} (part 2)`, obj.typeId, obj.parentId);
    newObj.content = originalContent;
    newObj.aliases = [...obj.aliases];
    newObj.attributes = obj.attributes ? JSON.parse(JSON.stringify(obj.attributes)) : [];
    newObj.rendered = obj.rendered;
    newObj.color = obj.color;
    newObj.icon = obj.icon;

    const siblings = objects.getChildren(obj.parentId);
    const originalIndex = siblings.findIndex((s) => s.id === obj.id);
    if (originalIndex >= 0 && originalIndex < siblings.length - 1) {
      const nextSibling = siblings[originalIndex + 1];
      newObj.sortOrder = ((obj.sortOrder ?? 0) + (nextSibling.sortOrder ?? 0)) / 2;
    } else {
      newObj.sortOrder = (obj.sortOrder ?? 0) + 1;
    }

    return newObj;
  }

  function splitEditorContent(): { before: JSONContent; after: JSONContent } | null {
    if (!editor) return null;
    const doc = editor.state.doc;
    const max = doc.content.size;
    const safePos = Math.max(1, Math.min(splitTextPosition, max - 1));
    if (safePos <= 1 || safePos >= max - 1) return null;

    const beforeDoc = doc.cut(0, safePos);
    const afterDoc = doc.cut(safePos, max);
    return {
      before: beforeDoc.toJSON() as JSONContent,
      after: afterDoc.toJSON() as JSONContent,
    };
  }

  $effect(async () => {
    if (!open || !obj || !isContentType) {
      if (editor) {
        editor.destroy();
        editor = null;
      }
      return;
    }

    await tick();
    if (!editorElement) return;

    if (editor) {
      editor.destroy();
    }

    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        ObjectRef.configure({
          resolveObject: (text: string) => {
            const match = objects.getByName(text);
            if (!match) return null;
            return {
              id: match.id,
              name: match.name,
              color: objects.getEffectiveColor(match.id),
            };
          },
        }),
      ],
      content: obj.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      editorProps: {
        attributes: {
          class: 'split-editor-content',
        },
        handleDOMEvents: {
          beforeinput: () => true,
          keydown: (_view, event) => {
            if (
              event.key === 'Backspace' ||
              event.key === 'Delete' ||
              event.key === 'Enter' ||
              event.key.length === 1
            ) {
              event.preventDefault();
              return true;
            }
            return false;
          },
        },
      },
      onSelectionUpdate: ({ editor }) => {
        splitTextPosition = editor.state.selection.from;
      },
    });

    splitTextPosition = editor.state.selection.from;
  });

  onDestroy(() => {
    if (editor) {
      editor.destroy();
      editor = null;
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!placementId || !placement || !hasRange) return;

    // Validate split position
    if (!canSplitTimeline) return;

    if (!isContentType || !editor || !obj) {
      const result = ops.splitPlacement(placementId, splitPosition);
      onSplit?.(result ? [result.before.id, result.after.id] : []);
      onClose();
      return;
    }

    const contentSplit = splitEditorContent();
    if (!contentSplit) return;

    const newObj = createSplitObject(contentSplit.after);
    const newPlacement = createPlacement(
      newObj.id,
      placement.type,
      splitPosition,
      placement.track,
      {
        endPosition: placement.endPosition,
        mutation: placement.mutation,
      }
    );

    const batch = timelineHistory.beginBatch(`Split "${obj.name}"`);
    batch.add(createUpdateObjectCommand(obj.id, { content: contentSplit.before }));
    batch.add(createAddObjectCommand(newObj));
    batch.add(createUpdatePlacementCommand(placement.id, { endPosition: splitPosition }));
    batch.add(createAddPlacementCommand(newPlacement));
    batch.commit();

    timelineEditor.clearSelection();
    timelineEditor.select(placement.id, true);
    timelineEditor.select(newPlacement.id, true);

    onSplit?.([placement.id, newPlacement.id]);
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

        {#if isContentType}
          <div class="form-group">
            <label class="form-label">Split Text</label>
            <div class="split-editor" bind:this={editorElement}></div>
            <div class="split-hint">
              Place the cursor where the text should split.
              {#if editor}
                <span class:invalid={!canSplitText}>
                  Cursor {splitTextPosition} (valid {textSplitBounds.min}-{textSplitBounds.max})
                </span>
              {/if}
            </div>
          </div>
        {:else}
          <div class="split-hint muted">
            This object has no text content. The split will only affect the timeline range.
          </div>
        {/if}

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
              <span class="item-name">{obj.name} (part 2)</span>
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
            disabled={!canSubmit}
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

  .split-editor {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background-color: var(--surface-base);
    padding: var(--space-sm);
    min-height: 160px;
    max-height: 240px;
    overflow-y: auto;
  }

  .split-editor :global(.split-editor-content) {
    outline: none;
    font-size: var(--font-size-sm);
    line-height: 1.6;
  }

  .split-hint {
    margin-top: var(--space-xs);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .split-hint.muted {
    margin-bottom: var(--space-md);
    color: var(--text-muted);
  }

  .split-hint .invalid {
    color: var(--color-danger, #ef4444);
    font-weight: 600;
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
