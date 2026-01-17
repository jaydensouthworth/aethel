<script lang="ts">
  import { onMount } from 'svelte';
  import { objects, timeline, ui, project, timelineEditor, milestones } from '$lib/stores';
  import { createObject, getObjectType, createMilestone, createSection } from '$lib/types';
  import type { TimelinePlacement, AethelObject } from '$lib/types';
  import ObjectTree from '$lib/components/ObjectTree.svelte';
  import ObjectPropertiesPanel from '$lib/components/ObjectPropertiesPanel.svelte';
  import SingleTrackTimeline from '$lib/components/timeline/SingleTrackTimeline.svelte';
  import SplashScreen from '$lib/components/SplashScreen.svelte';
  import Editor from '$lib/editor/Editor.svelte';
  import SectionTabs from '$lib/components/SectionTabs.svelte';
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

  // Track menu state - kept for backwards compatibility but may be simplified
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
  let lastTimelineTool = $state(timelineEditor.activeTool);

  // Computed state at cursor position (includes content after mutations)
  const objectState = $derived(
    selectedObject ? timeline.getObjectStateAtCursor(selectedObject.id) : null
  );

  // Get the active mutation (the one the user clicked to edit)
  const activeMutation = $derived(
    ui.activeMutationId ? timeline.getPlacement(ui.activeMutationId) : null
  );

  // Display content depends on whether there's an active mutation
  // If active mutation has contentChange, show that; otherwise show computed content
  const displayContent = $derived.by(() => {
    if (activeMutation?.mutation?.contentChange) {
      // Active mutation has its own content - show that
      return activeMutation.mutation.contentChange.to;
    }
    // No active mutation content, show computed content at cursor
    return objectState?.computedContent ?? selectedObject?.content ?? null;
  });

  // Check if we're viewing/editing a specific mutation
  const isEditingMutation = $derived(ui.activeMutationId !== null);

  // Check if we're viewing a mutated state (different from base)
  const isViewingMutatedState = $derived(
    objectState && objectState.mutations.length > 0
  );

  // Handle content changes - update mutation or base object
  function handleContentChange(newContent: unknown) {
    if (!selectedObject) return;

    if (ui.activeMutationId && activeMutation) {
      // We're editing at a specific mutation - update that mutation's contentChange
      const currentContent = activeMutation.mutation?.contentChange?.to ?? objectState?.computedContent ?? selectedObject.content;
      timeline.updateMutationContent(ui.activeMutationId, {
        from: currentContent,
        to: newContent as typeof currentContent,
      });
    } else {
      // No active mutation - update base object content
      objects.update(selectedObject.id, { content: newContent as typeof selectedObject.content });
    }
  }

  // Section support (multiple text contexts)
  const hasSections = $derived(selectedObject?.sections && selectedObject.sections.length > 0);
  const sortedSections = $derived(
    hasSections ? [...selectedObject!.sections!].sort((a, b) => a.sortOrder - b.sortOrder) : []
  );
  // Use $derived.by to explicitly access the reactive store property
  const activeSectionId = $derived.by(() => {
    if (!selectedObject) return null;
    // Access ui.activeSectionByObject directly to establish reactive dependency
    const stored = ui.activeSectionByObject[selectedObject.id];
    return stored ?? sortedSections[0]?.id ?? null;
  });
  const currentSection = $derived.by(() => {
    if (!activeSectionId || sortedSections.length === 0) return null;
    return sortedSections.find((s) => s.id === activeSectionId) ?? null;
  });
  // Use computed section content (with mutations applied) for display
  const displaySectionContent = $derived.by(() => {
    if (!activeSectionId || !objectState) return currentSection?.content ?? null;
    // Check if there's a computed version of this section
    const computed = objectState.computedSections[activeSectionId];
    return computed !== undefined ? computed : currentSection?.content ?? null;
  });

  // Section handlers
  function handleAddSection() {
    if (!selectedObject) return;
    const section = objects.addSection(selectedObject.id, `Section ${(selectedObject.sections?.length ?? 0) + 1}`);
    if (section) {
      ui.setActiveSection(selectedObject.id, section.id);
    }
  }

  function handleRemoveSection(sectionId: string) {
    if (!selectedObject) return;
    // If removing active section, switch to first remaining section
    if (activeSectionId === sectionId) {
      const remaining = sortedSections.filter((s) => s.id !== sectionId);
      if (remaining.length > 0) {
        ui.setActiveSection(selectedObject.id, remaining[0].id);
      }
    }
    objects.removeSection(selectedObject.id, sectionId);
  }

  function handleRenameSection(sectionId: string, newName: string) {
    if (!selectedObject) return;
    objects.updateSection(selectedObject.id, sectionId, { name: newName });
  }

  function handleSectionContentChange(content: unknown) {
    if (!selectedObject || !activeSectionId) return;
    objects.updateSection(selectedObject.id, activeSectionId, { content: content as any });
  }

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

  function getSplitTargetPlacementId(): string | null {
    const selectedIds = Array.from(timelineEditor.selectedPlacementIds);
    if (selectedIds.length > 0) return selectedIds[0];

    if (!selectedObject) return null;
    const placements = timeline.getPlacementsForObject(selectedObject.id);
    if (placements.length === 0) return null;

    const cursorPos = timeline.cursorPosition;
    const atCursor = placements.find((p) => {
      const end = p.endPosition ?? p.position;
      return cursorPos >= p.position && cursorPos <= end;
    });

    return (atCursor ?? placements[0]).id;
  }

  $effect(() => {
    const activeTool = timelineEditor.activeTool;
    if (
      activeTool === 'razor' &&
      lastTimelineTool !== 'razor' &&
      !splitDialogState.open
    ) {
      const placementId = getSplitTargetPlacementId();
      if (placementId) {
        openSplitDialog(placementId, timeline.cursorPosition);
      }
    }

    lastTimelineTool = activeTool;
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

    const threadsFolder = createObject('Threads', 'folder');
    threadsFolder.color = '#8b5cf6'; // purple for narrative threads

    // Add folders first
    [chaptersFolder, scenesFolder, charactersFolder, locationsFolder, itemsFolder, threadsFolder].forEach(
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
    // Chapter 1 demonstrates the new sections feature (Synopsis + Content)
    const ch1 = createObject('The Long-Expected Party', 'chapter', chaptersFolder.id);
    ch1.rendered = true;
    ch1.position = 1000;

    // Create sections for chapter 1 (book template: Synopsis + Content)
    const ch1Synopsis = createSection('Synopsis', 0);
    ch1Synopsis.content = textToContent(`Bilbo Baggins celebrates his 111th birthday with an extravagant party, then mysteriously disappears, leaving Bag End and his possessions to his nephew Frodo—including a certain gold ring.`);

    const ch1Content = createSection('Content', 1);
    ch1Content.content = {
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

    ch1.sections = [ch1Synopsis, ch1Content];

    const ch2 = createObject('The Shadow of the Past', 'chapter', chaptersFolder.id);
    ch2.rendered = true;
    ch2.position = 2000;
    ch2.timelineSlot = 1; // Same slot as ch2b - these happen simultaneously

    // Chapter 2 also uses sections
    const ch2Synopsis = createSection('Synopsis', 0);
    ch2Synopsis.content = textToContent(`Gandalf reveals the true nature of the Ring to Frodo, telling the story of its creation and the danger it poses.`);

    const ch2Content = createSection('Content', 1);
    ch2Content.content = {
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

    ch2.sections = [ch2Synopsis, ch2Content];

    // Parallel chapter - happens at the same time as ch2 (Gandalf's POV)
    const ch2b = createObject("Gandalf's Research", 'chapter', chaptersFolder.id);
    ch2b.rendered = true;
    ch2b.position = 2000; // Same position as ch2 - stacked together
    ch2b.timelineSlot = 1; // Same slot as ch2 - stacked together
    ch2b.content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Meanwhile, ' },
            ref(gandalf.id, 'Gandalf', charColor),
            { type: 'text', text: ' traveled to Minas Tirith to search the archives for knowledge of ' },
            ref(theRing.id, 'the Ring', itemColor),
            { type: 'text', text: '.' },
          ],
        },
      ],
    };

    const ch3 = createObject('Three is Company', 'chapter', chaptersFolder.id);
    ch3.rendered = true;
    ch3.position = 3000;
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
    // "Bilbo's Adventure" is a prologue/flashback - comes first
    const scene1 = createObject("Bilbo's Adventure", 'scene', scenesFolder.id);
    scene1.rendered = true;
    scene1.position = 500; // Prologue - before Chapter 1
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
    [ch1, ch2, ch2b, ch3, scene1, shire].forEach(
      (obj) => objects.add(obj)
    );

    // Expand all folders by default
    [chaptersFolder, scenesFolder, charactersFolder, locationsFolder, itemsFolder, threadsFolder].forEach(
      (folder) => ui.setTreeExpanded(folder.id, true)
    );

    // Create thread objects (narrative arcs are now AethelObjects with isThread=true)
    // Threads are chapter type (content type) so they can have sections/subthreads
    // They are not rendered as cards, just used as threads
    const ringThread = createObject("The Ring's Journey", 'chapter', threadsFolder.id);
    ringThread.isThread = true;
    ringThread.rendered = false;
    ringThread.threadColor = '#f59e0b';
    ringThread.color = '#f59e0b';
    objects.add(ringThread);

    const frodoThread = createObject("Frodo's Arc", 'chapter', threadsFolder.id);
    frodoThread.isThread = true;
    frodoThread.rendered = false;
    frodoThread.threadColor = '#3b82f6';
    frodoThread.color = '#3b82f6';
    // Add subthreads (sections) to Frodo's Arc
    const frodoInner = createSection('Inner Journey', 0);
    frodoInner.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: "Frodo's emotional and spiritual growth throughout the story." }] }] };
    const frodoOuter = createSection('Outer Journey', 1);
    frodoOuter.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: "Frodo's physical journey to Mordor." }] }] };
    frodoThread.sections = [frodoInner, frodoOuter];
    objects.add(frodoThread);

    // Make threads visible
    timelineEditor.showThread(ringThread.id);
    timelineEditor.showThread(frodoThread.id);

    // Create timeline placements (v2 single-track model)
    // Rendered chapters appear as cards in the flow
    timeline.addCreationV2(ch1.id);
    timeline.addCreationV2(ch2.id);
    timeline.addCreationV2(ch2b.id); // Stacked with ch2 (same timelineSlot)
    timeline.addCreationV2(ch3.id);

    // Scene appears in the flow (between chapters)
    timeline.addCreationV2(scene1.id);

    // Create a milestone (Act/Part divider) - position 1500 = between ch1 (1000) and ch2 (2000)
    const act1 = createMilestone('Act I: The Shire', 1500, {
      color: '#6366f1',
      exportAs: 'act',
    });
    milestones.add(act1);

    // Character mutations - attached below relevant chapters, with thread associations
    timeline.addMutationBelow(
      frodo.id,
      ch1.id,
      'Frodo inherits the Ring',
      { hasRing: { from: false, to: true } },
      [ringThread.id, frodoThread.id]
    );
    timeline.addMutationBelow(
      frodo.id,
      ch3.id,
      'Frodo leaves the Shire',
      { location: { from: 'Bag End', to: 'The Road' } },
      [frodoThread.id]
    );

    // Item mutations - attached below the chapter where it happens
    timeline.addMutationBelow(
      theRing.id,
      ch1.id,
      'Ring passes to Frodo',
      { owner: { from: 'Bilbo', to: 'Frodo' } },
      [ringThread.id]
    );

    // Standalone mutation between chapters (off-screen event)
    // Position 1250 = between ch1 (1000) and milestone (1500)
    timeline.addMutationBetween(
      gandalf.id,
      1250,
      'Gandalf researches the Ring',
      { knowledge: { from: 'suspicious', to: 'certain' } },
      [ringThread.id]
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
        {#if hasSections && sortedSections.length > 0 && activeSectionId}
          <SectionTabs
            sections={sortedSections}
            activeSectionId={activeSectionId}
            onSelect={(id) => ui.setActiveSection(selectedObject.id, id)}
            onAdd={handleAddSection}
            onRemove={handleRemoveSection}
            onRename={handleRenameSection}
          />
          {#if isEditingMutation && activeMutation}
            <div class="mutation-indicator editing">
              Editing mutation: {activeMutation.mutation?.label}
              <button class="view-initial-btn" onclick={() => ui.clearActiveMutation()}>View Initial</button>
            </div>
          {:else if isViewingMutatedState}
            <div class="mutation-indicator">
              Viewing at timeline position {timeline.cursorIndex} ({objectState?.mutations.length} mutation{objectState?.mutations.length === 1 ? '' : 's'} applied)
            </div>
          {/if}
          <Editor
            content={displaySectionContent}
            onchange={handleSectionContentChange}
            dark={theme === 'dark'}
          />
        {:else}
          {#if isEditingMutation && activeMutation}
            <div class="mutation-indicator editing">
              Editing mutation: {activeMutation.mutation?.label}
              <button class="view-initial-btn" onclick={() => ui.clearActiveMutation()}>View Initial</button>
            </div>
          {:else if isViewingMutatedState}
            <div class="mutation-indicator">
              Viewing at timeline position {timeline.cursorIndex} ({objectState?.mutations.length} mutation{objectState?.mutations.length === 1 ? '' : 's'} applied)
            </div>
          {/if}
          <Editor
            content={displayContent}
            onchange={handleContentChange}
            dark={theme === 'dark'}
          />
        {/if}
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
    <SingleTrackTimeline collapsed={ui.timelineCollapsed} />
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

  .mutation-indicator {
    padding: var(--space-xs) var(--space-md);
    background-color: var(--surface-sunken);
    border-bottom: 1px solid var(--border-subtle);
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .mutation-indicator::before {
    content: '⏱';
  }

  .mutation-indicator.editing {
    background-color: var(--color-primary);
    color: white;
    font-weight: 500;
  }

  .mutation-indicator.editing::before {
    content: '✏️';
  }

  .view-initial-btn {
    margin-left: auto;
    padding: var(--space-xs) var(--space-sm);
    background-color: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: var(--radius-sm);
    color: white;
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .view-initial-btn:hover {
    background-color: rgba(255, 255, 255, 0.3);
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
</style>
