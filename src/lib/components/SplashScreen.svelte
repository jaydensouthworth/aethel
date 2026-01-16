<script lang="ts">
  import { objects } from '$lib/stores';
  import { OBJECT_TYPES } from '$lib/types';

  interface Props {
    onCreateObject?: (typeId: string) => void;
  }

  let { onCreateObject }: Props = $props();

  const quickActions = [
    { typeId: 'chapter', label: 'New Chapter', icon: OBJECT_TYPES.chapter.icon },
    { typeId: 'scene', label: 'New Scene', icon: OBJECT_TYPES.scene.icon },
    { typeId: 'character', label: 'New Character', icon: OBJECT_TYPES.character.icon },
    { typeId: 'location', label: 'New Location', icon: OBJECT_TYPES.location.icon },
  ];
</script>

<div class="splash-screen">
  <div class="splash-content">
    <div class="logo-area">
      <h1 class="app-title">Aethel</h1>
      <p class="app-tagline">Timeline-first writing for complex narratives</p>
    </div>

    <div class="quick-actions">
      <h2>Get Started</h2>
      <div class="action-grid">
        {#each quickActions as action}
          <button
            class="action-btn"
            onclick={() => onCreateObject?.(action.typeId)}
          >
            <span class="action-icon">{action.icon}</span>
            <span class="action-label">{action.label}</span>
          </button>
        {/each}
      </div>
    </div>

    {#if objects.all.length > 0}
      <div class="recent-section">
        <h2>Recent Objects</h2>
        <div class="recent-list">
          {#each objects.all.slice(0, 5) as obj (obj.id)}
            <button class="recent-item">
              <span class="recent-icon">{OBJECT_TYPES[obj.typeId]?.icon ?? '📄'}</span>
              <span class="recent-name">{obj.name}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="tips-section">
      <h2>Tips</h2>
      <ul class="tips-list">
        <li>Use <kbd>[[Object Name]]</kbd> to reference other objects</li>
        <li>Toggle <strong>On Timeline</strong> to place objects in your story's chronology</li>
        <li>Mark objects as <strong>Rendered</strong> to include them in book output</li>
        <li>Use the timeline strip at the bottom to visualize your story structure</li>
      </ul>
    </div>
  </div>
</div>

<style>
  .splash-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--space-xl);
    background: linear-gradient(
      135deg,
      var(--surface-base) 0%,
      var(--surface-sunken) 100%
    );
  }

  .splash-content {
    max-width: 600px;
    text-align: center;
  }

  .logo-area {
    margin-bottom: 48px;
  }

  .app-title {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin: 0;
  }

  .app-tagline {
    font-size: var(--font-size-lg);
    color: var(--text-secondary);
    margin: var(--space-sm) 0 0;
  }

  h2 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin: 0 0 var(--space-md);
  }

  .quick-actions {
    margin-bottom: var(--space-xl);
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-md);
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    background-color: var(--surface-raised);
    transition: all var(--transition-normal);
  }

  .action-btn:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .action-icon {
    font-size: var(--font-size-2xl);
  }

  .action-label {
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--text-primary);
  }

  .recent-section {
    margin-bottom: var(--space-xl);
    text-align: left;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-lg);
    background: transparent;
    text-align: left;
    width: 100%;
    transition: background-color var(--transition-fast);
  }

  .recent-item:hover {
    background-color: var(--hover-bg);
  }

  .recent-icon {
    font-size: var(--font-size-lg);
  }

  .recent-name {
    font-size: var(--font-size-md);
    color: var(--text-primary);
  }

  .tips-section {
    text-align: left;
    background-color: var(--surface-sunken);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
  }

  .tips-list {
    margin: 0;
    padding: 0 0 0 20px;
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    line-height: 1.8;
    list-style: disc;
  }

  kbd {
    display: inline-block;
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    background-color: var(--surface-raised);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
  }
</style>
