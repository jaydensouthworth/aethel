<script lang="ts">
  import { onMount } from 'svelte';
  import { objects, timeline, ui, project, timelineEditor } from '$lib/stores';
  import { createObject, getObjectType } from '$lib/types';
  import type { TimelinePlacement, AethelObject } from '$lib/types';
  import ObjectTree from '$lib/components/ObjectTree.svelte';
  import ObjectPropertiesPanel from '$lib/components/ObjectPropertiesPanel.svelte';
  import TimelineStrip from '$lib/components/TimelineStrip.svelte';
  import TimelineToolbar from '$lib/components/timeline/TimelineToolbar.svelte';
  import SplashScreen from '$lib/components/SplashScreen.svelte';
  import Editor from '$lib/editor/Editor.svelte';
  import { handleKeyDown as handleTimelineShortcut } from '$lib/services/timeline-shortcuts';

  // Context menus
  import {
    TimelinePlacementContextMenu,
    TimelineTrackContextMenu,
    ObjectTreeContextMenu,
  } from '$lib/components/timeline/context';

  // Dialogs
  import {
    CreateObjectDialog,
    MutationDialog,
    MarkerDialog,
    SplitDialog,
  } from '$lib/components/timeline/dialogs';

  import '$lib/styles/theme.css';
  import '$lib/styles/reset.css';

  let theme = $state<'light' | 'dark'>('light');
  let isResizing = $state(false);
  let isResizingTimeline = $state(false);

  // Context menu state
  let placementMenuState = $state({
    open: false,
    x: 0,
    y: 0,
    placement: null as TimelinePlacement | null,
  });

  let trackMenuState = $state({
    open: false,
    x: 0,
    y: 0,
    trackIndex: 0,
    position: 0,
  });

  let treeMenuState = $state({
    open: false,
    x: 0,
    y: 0,
    object: null as AethelObject | null,
  });

  // Dialog state
  let createDialogState = $state({
    open: false,
    track: 0,
    position: 0,
    parentId: null as string | null,
  });

  let mutationDialogState = $state({
    open: false,
    objectId: null as string | null,
    position: 0,
    track: 0,
  });

  let markerDialogState = $state({
    open: false,
    position: 0,
    markerId: null as string | null,
  });

  let splitDialogState = $state({
    open: false,
    placementId: null as string | null,
    position: null as number | null,
  });

  // Selected object for editing
  const selectedObject = $derived(ui.selectedObject);
  const selectedObjectType = $derived(selectedObject ? getObjectType(selectedObject.typeId) : null);
  const isContentType = $derived(selectedObjectType?.isContentType ?? false);

  // Track changes for auto-save
  let lastObjectsHash = $state('');
  let lastTimelineHash = $state('');

  // Simple hash function for change detection
  function hashState(): string {
    return JSON.stringify({
      o: objects.all.length,
      t: timeline.allPlacements.length,
      c: timeline.cursorPosition,
    });
  }

  // Effect to detect changes and mark dirty
  $effect(() => {
    const currentHash = hashState();
    if (lastObjectsHash && currentHash !== lastObjectsHash) {
      project.markDirty();
    }
    lastObjectsHash = currentHash;
  });

  // Initialize on mount - try to restore auto-save first
  onMount(async () => {
    const restored = await project.tryRestoreAutoSave();
    if (!restored) {
      // No auto-save found, initialize with sample data
      initializeSampleData();
    }
  });

  // Project action handlers
  async function handleNewProject() {
    if (project.isDirty) {
      const confirmed = confirm('You have unsaved changes. Create new project anyway?');
      if (!confirmed) return;
    }
    await project.newProject();
    initializeSampleData();
  }

  async function handleSaveProject() {
    await project.exportProject();
  }

  async function handleOpenProject() {
    if (project.isDirty) {
      const confirmed = confirm('You have unsaved changes. Open a different project?');
      if (!confirmed) return;
    }
    await project.importProject();
  }

  // Helper to create TipTap JSON content from text
  function textToContent(text: string) {
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    return {
      type: 'doc',
      content: paragraphs.map(p => ({
        type: 'paragraph',
        content: [{ type: 'text', text: p.trim() }]
      }))
    };
  }

  // Helper to create an object reference node
  function ref(objectId: string, name: string, color: string) {
    return {
      type: 'objectRef',
      attrs: {
        objectId,
        displayText: name,
        status: 'resolved',
        color,
      },
    };
  }

  function initializeSampleData() {
    // Create folder objects for organization
    const chaptersFolder = createObject('Chapters', 'folder');
    chaptersFolder.color = '#3b82f6'; // blue - matches chapter type

    const scenesFolder = createObject('Scenes', 'folder');
    scenesFolder.color = '#8b5cf6'; // purple - matches scene type

    const charactersFolder = createObject('Characters', 'folder');
    charactersFolder.color = '#06b6d4'; // cyan - matches character type

    const locationsFolder = createObject('Locations', 'folder');
    locationsFolder.color = '#22c55e'; // green - matches location type

    const itemsFolder = createObject('Items', 'folder');
    itemsFolder.color = '#f59e0b'; // amber - matches item type

    // Add folders first
    [chaptersFolder, scenesFolder, charactersFolder, locationsFolder, itemsFolder].forEach(
      (folder) => objects.add(folder)
    );

    // Create Characters FIRST so we can reference them
    const bilbo = createObject('Bilbo Baggins', 'character', charactersFolder.id);
    bilbo.aliases = ['Mr. Baggins', 'Bilbo'];
    bilbo.content = textToContent(`An elderly hobbit, famous for his adventure sixty years ago and his great wealth.`);

    const frodo = createObject('Frodo Baggins', 'character', charactersFolder.id);
    frodo.aliases = ['Frodo', 'Mr. Frodo'];
    frodo.content = textToContent(`Bilbo's nephew and heir. A young hobbit about to inherit more than he bargained for.`);

    const gandalf = createObject('Gandalf', 'character', charactersFolder.id);
    gandalf.aliases = ['Gandalf the Grey', 'Mithrandir', 'The Grey Pilgrim'];
    gandalf.content = textToContent(`A wizard of the Istari order. Old friend of Bilbo.`);

    const sam = createObject('Sam Gamgee', 'character', charactersFolder.id);
    sam.aliases = ['Sam', 'Samwise'];
    sam.content = textToContent(`Frodo's gardener and loyal friend.`);

    // Locations - parented under Locations folder
    const bagEnd = createObject('Bag End', 'location', locationsFolder.id);
    bagEnd.content = textToContent(`A luxurious hobbit-hole in Hobbiton, home of Bilbo Baggins.`);

    const hobbiton = createObject('Hobbiton', 'location', locationsFolder.id);
    hobbiton.content = textToContent(`A village in the Shire.`);

    // Items
    const theRing = createObject('The One Ring', 'item', itemsFolder.id);
    theRing.aliases = ['The Ring', 'Isildur\'s Bane'];
    theRing.content = textToContent(`A gold ring of great power, forged by the Dark Lord Sauron.`);

    // Add all entities
    [bilbo, frodo, gandalf, sam, bagEnd, hobbiton, theRing].forEach((obj) => objects.add(obj));

    // Character color for references
    const charColor = '#06b6d4';
    const locColor = '#22c55e';
    const itemColor = '#f59e0b';

    // Chapters (rendered) - parented under Chapters folder - with object references!
    const ch1 = createObject('The Long-Expected Party', 'chapter', chaptersFolder.id);
    ch1.rendered = true;
    ch1.content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'When Mr. ' },
            ref(bilbo.id, 'Bilbo Baggins', charColor),
            { type: 'text', text: ' of ' },
            ref(bagEnd.id, 'Bag End', locColor),
            { type: 'text', text: ' announced that he would shortly be celebrating his eleventy-first birthday, there was much talk and excitement in ' },
            ref(hobbiton.id, 'Hobbiton', locColor),
            { type: 'text', text: '.' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Sixty years before, the remarkable disappearance and unexpected return of Mr. Baggins had been a nine days\' wonder. The riches he brought back from his adventure were legendary.' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'The old hobbit had been preparing for his departure, though none knew it. His nephew ' },
            ref(frodo.id, 'Frodo', charColor),
            { type: 'text', text: ' would inherit ' },
            ref(bagEnd.id, 'Bag End', locColor),
            { type: 'text', text: ' and most of his possessions — including, though it was not discussed, a certain ' },
            ref(theRing.id, 'gold ring', itemColor),
            { type: 'text', text: '.' },
          ],
        },
      ],
    };

    const ch2 = createObject('The Shadow of the Past', 'chapter', chaptersFolder.id);
    ch2.rendered = true;
    ch2.content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'The talk did not die down in nine days, or even in ninety-nine. ' },
            ref(gandalf.id, 'Gandalf', charColor),
            { type: 'text', text: ' came to visit, bringing news of the wider world.' },
          ],
        },
      ],
    };

    const ch3 = createObject('Three is Company', 'chapter', chaptersFolder.id);
    ch3.rendered = true;
    ch3.content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            ref(frodo.id, 'Frodo', charColor),
            { type: 'text', text: ' set out from ' },
            ref(bagEnd.id, 'Bag End', locColor),
            { type: 'text', text: ' with ' },
            ref(sam.id, 'Sam', charColor),
            { type: 'text', text: ' and Pippin.' },
          ],
        },
      ],
    };

    // Scenes - parented under Scenes folder
    const scene1 = createObject("Bilbo's Adventure", 'scene', scenesFolder.id);
    scene1.rendered = true;
    scene1.content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Long ago, ' },
            ref(bilbo.id, 'Bilbo Baggins', charColor),
            { type: 'text', text: ' had his unexpected journey...' },
          ],
        },
      ],
    };

    const shire = createObject('The Shire', 'location', locationsFolder.id);
    shire.content = textToContent(`The peaceful homeland of the hobbits.`);

    // Add remaining content objects
    [ch1, ch2, ch3, scene1, shire].forEach(
      (obj) => objects.add(obj)
    );

    // Expand all folders by default
    [chaptersFolder, scenesFolder, charactersFolder, locationsFolder, itemsFolder].forEach(
      (folder) => ui.setTreeExpanded(folder.id, true)
    );

    // Create timeline placements
    // Track 0: Chapters (story structure)
    timeline.addCreation(ch1.id, 1, 0);
    timeline.addCreation(ch2.id, 2, 0);
    timeline.addCreation(ch3.id, 3, 0);

    // Track 1: Scenes and flashbacks
    timeline.addCreation(scene1.id, 0.5, 1);

    // Track 2: Character mutations (state changes)
    timeline.addMutation(
      frodo.id,
      1,
      'Frodo inherits the Ring',
      { hasRing: { from: false, to: true } },
      2
    );
    timeline.addMutation(
      frodo.id,
      3,
      'Frodo leaves the Shire',
      { location: { from: 'Bag End', to: 'The Road' } },
      2
    );

    // Track 3: Item mutations
    timeline.addMutation(
      theRing.id,
      1,
      'Ring passes to Frodo',
      { owner: { from: 'Bilbo', to: 'Frodo' } },
      3
    );
  }

  function handleCreateObject(typeId: string) {
    const name = prompt(`Enter name for new ${typeId}:`);
    if (name) {
      const obj = objects.create(name, typeId);
      ui.select(obj.id);
    }
  }

  function handleResizeStart(e: MouseEvent) {
    isResizing = true;
    const startX = e.clientX;
    const startWidth = ui.treePanelWidth;

    function onMouseMove(e: MouseEvent) {
      const delta = e.clientX - startX;
      ui.setTreePanelWidth(startWidth + delta);
    }

    function onMouseUp() {
      isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
  }

  function handleTimelineResizeStart(e: MouseEvent) {
    isResizingTimeline = true;
    const startY = e.clientY;
    const startHeight = timeline.panelHeight;

    function onMouseMove(e: MouseEvent) {
      const delta = startY - e.clientY; // Inverted because we're dragging up to increase
      timeline.setPanelHeight(startHeight + delta);
    }

    function onMouseUp() {
      isResizingTimeline = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // Context menu handlers
  function handlePlacementContextMenu(e: MouseEvent, placement: TimelinePlacement) {
    e.preventDefault();
    e.stopPropagation();
    // Close any other menus first
    closeAllMenus();

    placementMenuState = {
      open: true,
      x: e.clientX,
      y: e.clientY,
      placement,
    };
  }

  function handlePlacementSplit(placement: TimelinePlacement, position: number) {
    closeAllMenus();
    openSplitDialog(placement.id, position);
  }

  function handleTrackContextMenu(e: MouseEvent, trackIndex: number, position: number) {
    e.preventDefault();
    e.stopPropagation();
    closeAllMenus();

    trackMenuState = {
      open: true,
      x: e.clientX,
      y: e.clientY,
      trackIndex,
      position,
    };
  }

  function handleTreeContextMenu(e: MouseEvent, obj: AethelObject) {
    e.preventDefault();
    e.stopPropagation();
    closeAllMenus();

    treeMenuState = {
      open: true,
      x: e.clientX,
      y: e.clientY,
      object: obj,
    };
  }

  function closeAllMenus() {
    placementMenuState.open = false;
    trackMenuState.open = false;
    treeMenuState.open = false;
  }

  // Dialog handlers
  function openCreateDialog(track: number = 0, position: number = timeline.cursorPosition, parentId: string | null = null) {
    createDialogState = {
      open: true,
      track,
      position,
      parentId,
    };
  }

  function openMutationDialog(objectId: string, position: number = timeline.cursorPosition, track: number = 0) {
    mutationDialogState = {
      open: true,
      objectId,
      position,
      track,
    };
  }

  function openMarkerDialog(position: number = timeline.cursorPosition, markerId: string | null = null) {
    markerDialogState = {
      open: true,
      position,
      markerId,
    };
  }

  function openSplitDialog(placementId: string, position: number | null = null) {
    splitDialogState = {
      open: true,
      placementId,
      position: position ?? timeline.cursorPosition,
    };
  }

  function closeAllDialogs() {
    createDialogState.open = false;
    mutationDialogState.open = false;
    markerDialogState.open = false;
    splitDialogState.open = false;
  }

  // Keyboard shortcut handler
  function handleGlobalKeyDown(e: KeyboardEvent) {
    // Let the timeline shortcut handler try first
    const handled = handleTimelineShortcut(e);
    if (handled) return;

    // Additional global shortcuts can be handled here
  }

  // Handle double-click on timeline to create object
  function handleTimelineCreateObject(track: number, position: number) {
    openCreateDialog(track, position);
  }
</script>

<svelte:window onkeydown={handleGlobalKeyDown} />

<div class="app" data-theme={theme} class:resizing={isResizing || isResizingTimeline}>
  <header class="toolbar">
    <div class="toolbar-left">
      <h1>Aethel</h1>
    </div>
    <div class="toolbar-center">
      {#if selectedObject}
        <span class="current-object">{selectedObject.name}</span>
      {/if}
    </div>
    <div class="toolbar-right">
      <button onclick={handleNewProject} title="New Project" class="toolbar-btn">
        New
      </button>
      <button onclick={handleOpenProject} title="Open Project" class="toolbar-btn">
        Open
      </button>
      <button onclick={handleSaveProject} title="Save Project" class="toolbar-btn">
        Save
      </button>
      {#if project.isDirty}
        <span class="unsaved-indicator" title="Unsaved changes">*</span>
      {/if}
      {#if project.isSaving}
        <span class="saving-indicator">Saving...</span>
      {/if}
      <button onclick={toggleTheme} class="toolbar-btn">
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </div>
  </header>

  <div class="main-area">
    <aside class="tree-panel" style:width="{ui.treePanelWidth}px">
      <ObjectTree oncontextmenu={handleTreeContextMenu} />
    </aside>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="resize-handle"
      role="separator"
      tabindex="0"
      onmousedown={handleResizeStart}
    ></div>

    <aside
      class="properties-panel-container"
      style:width="{ui.propertiesPanelCollapsed ? 40 : 280}px"
    >
      <ObjectPropertiesPanel />
    </aside>

    <main class="content-panel">
      {#if selectedObject && isContentType}
        <Editor
          content={selectedObject.content}
          onchange={(newContent) => objects.update(selectedObject.id, { content: newContent })}
          dark={theme === 'dark'}
        />
      {:else if selectedObject && !isContentType}
        <div class="folder-view">
          <div class="folder-icon" style:color={objects.getEffectiveColor(selectedObject.id)}>
            {objects.getEffectiveIcon(selectedObject.id)}
          </div>
          <h2 class="folder-name">{selectedObject.name}</h2>
          <p class="folder-hint">
            {#if objects.getChildren(selectedObject.id).length > 0}
              {objects.getChildren(selectedObject.id).length} item{objects.getChildren(selectedObject.id).length === 1 ? '' : 's'} in this folder
            {:else}
              Drag items here to organize them
            {/if}
          </p>
        </div>
      {:else}
        <SplashScreen onCreateObject={handleCreateObject} />
      {/if}
    </main>
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="timeline-resize-handle"
    role="separator"
    tabindex="0"
    onmousedown={handleTimelineResizeStart}
  ></div>

  <footer
    class="timeline-panel"
    class:collapsed={ui.timelineCollapsed}
    style:height="{ui.timelineCollapsed ? 40 : timeline.panelHeight}px"
  >
    {#if !ui.timelineCollapsed}
      <TimelineToolbar />
    {/if}
    <div class="timeline-strip-wrapper">
      <TimelineStrip
        onplacementcontextmenu={handlePlacementContextMenu}
        onplacementsplit={handlePlacementSplit}
        ontrackcontextmenu={handleTrackContextMenu}
        oncreateobject={handleTimelineCreateObject}
      />
    </div>
  </footer>
</div>

<!-- Context Menus -->
<TimelinePlacementContextMenu
  open={placementMenuState.open}
  x={placementMenuState.x}
  y={placementMenuState.y}
  placement={placementMenuState.placement}
  onClose={() => placementMenuState.open = false}
  onShowMutationDialog={(_, objectId) => openMutationDialog(objectId, placementMenuState.placement?.position ?? 0)}
  onShowSplitDialog={(placementId) => openSplitDialog(placementId)}
/>

<TimelineTrackContextMenu
  open={trackMenuState.open}
  x={trackMenuState.x}
  y={trackMenuState.y}
  trackIndex={trackMenuState.trackIndex}
  position={trackMenuState.position}
  onClose={() => trackMenuState.open = false}
  onShowCreateDialog={(track, position) => openCreateDialog(track, position)}
  onShowMutationDialog={(track, position) => {
    // For track context menu, we need to show a dialog to select which object
    // For now, just open create dialog
    openCreateDialog(track, position);
  }}
  onShowMarkerDialog={(position) => openMarkerDialog(position)}
/>

<ObjectTreeContextMenu
  open={treeMenuState.open}
  x={treeMenuState.x}
  y={treeMenuState.y}
  object={treeMenuState.object}
  onClose={() => treeMenuState.open = false}
  onShowCreateDialog={(parentId) => openCreateDialog(0, timeline.cursorPosition, parentId)}
/>

<!-- Dialogs -->
<CreateObjectDialog
  open={createDialogState.open}
  track={createDialogState.track}
  position={createDialogState.position}
  parentId={createDialogState.parentId}
  onClose={() => createDialogState.open = false}
/>

<MutationDialog
  open={mutationDialogState.open}
  objectId={mutationDialogState.objectId}
  position={mutationDialogState.position}
  track={mutationDialogState.track}
  onClose={() => mutationDialogState.open = false}
/>

<MarkerDialog
  open={markerDialogState.open}
  position={markerDialogState.position}
  markerId={markerDialogState.markerId}
  onClose={() => markerDialogState.open = false}
/>

<SplitDialog
  open={splitDialogState.open}
  placementId={splitDialogState.placementId}
  splitPosition={splitDialogState.position}
  onClose={() => splitDialogState.open = false}
/>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: var(--surface-base);
    color: var(--text-primary);
    font-family: var(--font-sans);
  }

  .app.resizing {
    cursor: col-resize;
    user-select: none;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    background-color: var(--surface-raised);
    border-bottom: 1px solid var(--border-subtle);
    z-index: 10;
  }

  .toolbar-left,
  .toolbar-right {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .toolbar-right {
    justify-content: flex-end;
  }

  .toolbar-center {
    flex: 2;
    text-align: center;
  }

  .toolbar h1 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .current-object {
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--text-secondary);
  }

  .toolbar button {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background-color: transparent;
    font-size: var(--font-size-sm);
    transition: all var(--transition-normal);
  }

  .toolbar button:hover {
    background-color: var(--hover-bg);
  }

  .toolbar-btn {
    margin-left: var(--space-xs);
  }

  .unsaved-indicator {
    font-size: var(--font-size-lg);
    font-weight: bold;
    color: var(--warning-color, #f59e0b);
    margin-left: var(--space-xs);
  }

  .saving-indicator {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin-left: var(--space-xs);
  }

  .main-area {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .tree-panel {
    flex-shrink: 0;
    overflow: hidden;
    background-color: var(--surface-raised);
    border-right: 1px solid var(--border-subtle);
  }

  .properties-panel-container {
    flex-shrink: 0;
    overflow: hidden;
    transition: width var(--transition-normal);
  }

  .resize-handle {
    width: 4px;
    cursor: col-resize;
    background: transparent;
    transition: background-color var(--transition-normal);
  }

  .resize-handle:hover,
  .app.resizing .resize-handle {
    background-color: var(--border-default);
  }

  .content-panel {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .folder-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    color: var(--text-secondary);
  }

  .folder-icon {
    font-size: 64px;
    opacity: 0.6;
  }

  .folder-name {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .folder-hint {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin: 0;
  }

  .timeline-resize-handle {
    height: 4px;
    cursor: row-resize;
    background: transparent;
    transition: background-color var(--transition-normal);
    flex-shrink: 0;
  }

  .timeline-resize-handle:hover,
  .app.resizing .timeline-resize-handle {
    background-color: var(--border-default);
  }

  .timeline-panel {
    flex-shrink: 0;
    transition: height var(--transition-slow);
  }

  .timeline-panel.collapsed {
    height: 40px !important;
  }

  .timeline-strip-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
