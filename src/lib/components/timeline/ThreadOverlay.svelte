<script lang="ts">
  import { timeline, threads, timelineEditor } from '$lib/stores';

  interface Props {
    /** Reference to the timeline container element for position calculations */
    containerRef?: HTMLElement | null;
  }

  let { containerRef = null }: Props = $props();

  // Get threads that should show connecting lines
  const activeThreads = $derived(
    threads.all.filter(
      (t) => t.showOnTimeline && t.showConnectingLines && timelineEditor.isThreadVisible(t.id)
    )
  );

  // Build connection paths for each thread
  const threadPaths = $derived.by(() => {
    if (!containerRef) return [];

    const paths: Array<{
      threadId: string;
      color: string;
      d: string;
    }> = [];

    for (const thread of activeThreads) {
      // Get all placements in this thread
      const placements = timeline.getPlacementsInThread(thread.id);
      if (placements.length < 2) continue;

      // Sort placements by their timeline position
      const sortedPlacements = placements.sort((a, b) => {
        // Use afterRenderedIndex or attachedToObjectId to determine position
        const aIdx = a.afterRenderedIndex ?? timeline.getCardIndex(a.attachedToObjectId ?? '');
        const bIdx = b.afterRenderedIndex ?? timeline.getCardIndex(b.attachedToObjectId ?? '');
        return aIdx - bIdx;
      });

      // Build SVG path connecting placements
      // This is a simplified version - in production you'd calculate actual positions
      // from the DOM elements
      const points: Array<{ x: number; y: number }> = [];

      for (const placement of sortedPlacements) {
        // Calculate approximate x position based on index
        const idx = placement.afterRenderedIndex ?? timeline.getCardIndex(placement.attachedToObjectId ?? '');
        if (idx >= 0) {
          // Estimate position (in production, read from DOM)
          const x = 100 + idx * 200; // Approximate card spacing
          const y = placement.mutationDisplay === 'below' ? 80 : 50;
          points.push({ x, y });
        }
      }

      if (points.length >= 2) {
        // Build smooth curve path
        let d = `M ${points[0].x} ${points[0].y}`;

        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const midX = (prev.x + curr.x) / 2;

          // Bezier curve for smooth connections
          d += ` Q ${midX} ${prev.y}, ${midX} ${(prev.y + curr.y) / 2}`;
          d += ` Q ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
        }

        paths.push({
          threadId: thread.id,
          color: thread.color,
          d,
        });
      }
    }

    return paths;
  });
</script>

{#if activeThreads.length > 0 && containerRef}
  <svg class="thread-overlay" aria-hidden="true">
    <defs>
      {#each activeThreads as thread (thread.id)}
        <linearGradient id="gradient-{thread.id}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color={thread.color} stop-opacity="0.3" />
          <stop offset="50%" stop-color={thread.color} stop-opacity="0.6" />
          <stop offset="100%" stop-color={thread.color} stop-opacity="0.3" />
        </linearGradient>
      {/each}
    </defs>

    <g class="thread-paths">
      {#each threadPaths as path (path.threadId)}
        <!-- Shadow/glow effect -->
        <path
          d={path.d}
          fill="none"
          stroke={path.color}
          stroke-width="6"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.15"
        />
        <!-- Main line -->
        <path
          d={path.d}
          fill="none"
          stroke="url(#gradient-{path.threadId})"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="thread-line"
        />
        <!-- Dots at connection points -->
        <!-- (Would be added based on actual positions) -->
      {/each}
    </g>
  </svg>
{/if}

<style>
  .thread-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
    z-index: 1;
  }

  .thread-line {
    transition: stroke-width var(--transition-fast), opacity var(--transition-fast);
  }

  .thread-overlay:hover .thread-line {
    stroke-width: 3;
    opacity: 0.8;
  }
</style>
