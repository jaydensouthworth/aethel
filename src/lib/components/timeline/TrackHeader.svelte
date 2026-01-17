<script lang="ts">
  import { timeline, timelineEditor } from '$lib/stores';
  import type { TimelineTrack, TimelinePlacement } from '$lib/types';

  interface Props {
    trackIndex: number;
    oncontextmenu?: (e: MouseEvent, trackIndex: number) => void;
  }

  let { trackIndex, oncontextmenu }: Props = $props();

  // Note: In v3 timeslot model, multiple tracks are not supported
  // This component is deprecated but kept for API compatibility
  const isLocked = $derived(timelineEditor.isTrackLocked(trackIndex));
  const placementCount = $derived(timeline.allPlacements.length);
  let isMuted = $state(false);
  let isSolo = $state(false);

  // Editing state
  let isEditing = $state(false);
  let editName = $state('');

  function startEditing() {
    editName = `Track ${trackIndex}`;
    isEditing = true;
  }

  function finishEditing() {
    // No-op in v3 model - tracks don't have configurable names
    isEditing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      finishEditing();
    } else if (e.key === 'Escape') {
      isEditing = false;
    }
  }

  function toggleLock() {
    timelineEditor.toggleTrackLock(trackIndex);
  }

  function toggleMute() {
    isMuted = !isMuted;
  }

  function toggleSolo() {
    isSolo = !isSolo;
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    oncontextmenu?.(e, trackIndex);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="track-header"
  class:locked={isLocked}
  class:muted={isMuted}
  class:solo={isSolo}
  style:--track-color={'var(--text-muted)'}
  oncontextmenu={handleContextMenu}
  ondblclick={startEditing}
>
  <div class="track-color-bar"></div>

  <div class="track-info">
    {#if isEditing}
      <input
        type="text"
        class="track-name-input"
        bind:value={editName}
        onblur={finishEditing}
        onkeydown={handleKeydown}
        autofocus
      />
    {:else}
      <span class="track-name" title="Double-click to rename">
        Timeline
      </span>
    {/if}

    {#if placementCount > 0}
      <span class="track-count">{placementCount}</span>
    {/if}
  </div>

  <div class="track-controls">
    <button
      class="track-btn"
      class:active={isMuted}
      title={isMuted ? 'Unmute track' : 'Mute track'}
      onclick={toggleMute}
    >
      M
    </button>
    <button
      class="track-btn"
      class:active={isSolo}
      title={isSolo ? 'Unsolo track' : 'Solo track'}
      onclick={toggleSolo}
    >
      S
    </button>
    <button
      class="track-btn"
      class:active={isLocked}
      title={isLocked ? 'Unlock track' : 'Lock track'}
      onclick={toggleLock}
    >
      {isLocked ? '🔒' : '🔓'}
    </button>
  </div>
</div>

<style>
  .track-header {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    width: 100%;
    height: 100%;
    padding: var(--space-xs);
    background-color: var(--surface-raised);
    border-right: 1px solid var(--border-subtle);
    position: relative;
    cursor: default;
    user-select: none;
  }

  .track-header.locked {
    background-color: var(--surface-sunken);
  }

  .track-header.muted {
    opacity: 0.5;
  }

  .track-color-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background-color: var(--track-color);
  }

  .track-info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding-left: var(--space-xs);
  }

  .track-name {
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track-name-input {
    width: 100%;
    padding: 2px 4px;
    font-size: var(--font-size-xs);
    font-weight: 500;
    background-color: var(--surface-base);
    border: 1px solid var(--color-accent, #3b82f6);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
  }

  .track-count {
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 8px;
    background-color: var(--hover-bg);
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .track-controls {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .track-btn {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 600;
    color: var(--text-muted);
    background-color: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .track-btn:hover {
    background-color: var(--hover-bg);
    color: var(--text-primary);
  }

  .track-btn.active {
    background-color: var(--color-accent, #3b82f6);
    border-color: var(--color-accent, #3b82f6);
    color: white;
  }

  .track-header.solo .track-btn.active:not(:last-child) {
    background-color: var(--color-warning, #f59e0b);
    border-color: var(--color-warning, #f59e0b);
  }
</style>
