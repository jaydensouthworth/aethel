<script lang="ts">
	import { ui, objects, timeline } from '$lib/stores';
	import { timelineEditor } from '$lib/stores/timeline-editor.svelte';
	import { getObjectType } from '$lib/types';
	import * as ops from '$lib/services/timeline-operations';
	import ColorPicker from './ColorPicker.svelte';
	import IconPicker from './IconPicker.svelte';
	import CollapsibleSection from './CollapsibleSection.svelte';

	// Derived values directly from stores
	const selectedObject = $derived(ui.selectedObject);
	const objectType = $derived(selectedObject ? getObjectType(selectedObject.typeId) : null);
	const objectState = $derived(
		selectedObject ? timeline.getObjectStateAtCursor(selectedObject.id) : null
	);

	// Color inheritance
	const effectiveColor = $derived(
		selectedObject ? objects.getEffectiveColor(selectedObject.id) : null
	);
	const isColorInherited = $derived(
		selectedObject ? objects.isColorInherited(selectedObject.id) : true
	);

	// Get parent's effective color for inheritance display
	const inheritedColor = $derived.by(() => {
		if (!selectedObject?.parentId) return objectType?.color;
		return objects.getEffectiveColor(selectedObject.parentId);
	});

	// Icon inheritance
	const isIconInherited = $derived(
		selectedObject ? objects.isIconInherited(selectedObject.id) : true
	);

	// Get parent's effective icon for inheritance display
	const inheritedIcon = $derived.by(() => {
		if (!selectedObject) return undefined;
		if (selectedObject.parentId) {
			return objects.getEffectiveIcon(selectedObject.parentId);
		}
		// No parent - use type's default icon
		return getObjectType(selectedObject.typeId).icon;
	});

	// Thread-related derived values
	const isThreadObject = $derived(selectedObject?.isThread ?? false);
	const cardsInThread = $derived(
		isThreadObject && selectedObject ? timeline.getCardsInThread(selectedObject.id) : []
	);
	const cardsNotInThread = $derived(
		isThreadObject && selectedObject ? timeline.getCardsNotInThread(selectedObject.id) : []
	);
	// Thread sections (subthreads)
	const threadSections = $derived(
		isThreadObject && selectedObject ? objects.getSections(selectedObject.id) : []
	);
	const hasSubthreads = $derived(threadSections.length > 0);

	// Track which card rows are expanded to show subthread options
	let expandedCardIds = $state<Set<string>>(new Set());

	// Local state for editing
	let editingName = $state(false);
	let nameValue = $state('');
	let newAlias = $state('');
	let showMutationEditor = $state(false);
	let newMutationLabel = $state('');
	let mutationMode = $state<'at-cursor' | 'at-position' | 'below-card'>('at-cursor');
	let attachToCardId = $state<string | null>(null);
	let targetTimeslotIndex = $state<number>(0);

	// Start editing name
	function handleEditName() {
		if (selectedObject) {
			nameValue = selectedObject.name;
			editingName = true;
		}
	}

	// Save name
	function handleSaveName() {
		if (selectedObject && nameValue.trim() && nameValue !== selectedObject.name) {
			ops.updateObjectName(selectedObject.id, nameValue.trim());
		}
		editingName = false;
	}

	// Handle name keydown
	function handleNameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleSaveName();
		} else if (e.key === 'Escape') {
			editingName = false;
		}
	}

	// Toggle rendered
	function handleToggleRendered() {
		if (selectedObject) {
			ops.toggleRendered(selectedObject.id);
		}
	}

	// Add alias
	function handleAddAlias() {
		if (selectedObject && newAlias.trim()) {
			ops.addObjectAlias(selectedObject.id, newAlias.trim());
			newAlias = '';
		}
	}

	// Remove alias
	function handleRemoveAlias(index: number) {
		if (selectedObject) {
			ops.removeObjectAlias(selectedObject.id, index);
		}
	}

	// Jump to mutation - moves cursor to the timeslot containing the mutation
	// Also sets the active mutation so editing updates that mutation's content.
	function handleJumpToMutation(mutationId: string, attachedToCardId?: string) {
		// Set this as the active mutation - editing will now update THIS mutation's content
		ui.setActiveMutation(mutationId);

		// Get the mutation placement to find its timeslot
		const placement = timeline.getPlacement(mutationId);
		if (!placement) return;

		// Find the index of the timeslot this mutation is in
		const timeslotIndex = timeline.getTimeslotIndex(placement.timeslotId);
		if (timeslotIndex >= 0) {
			timeline.setCursorIndex(timeslotIndex);
		} else if (attachedToCardId) {
			// Fallback: try to find the card it's attached to
			const attachedIndex = timeline.getCardIndex(attachedToCardId);
			if (attachedIndex >= 0) {
				timeline.setCursorIndex(attachedIndex);
			}
		}
	}

	// Add new mutation
	function handleAddMutation() {
		if (!selectedObject || !newMutationLabel.trim()) return;

		if (mutationMode === 'at-cursor') {
			// Use current cursor position
			ops.addMutationAtCurrent(
				selectedObject.id,
				newMutationLabel.trim(),
				{}
			);
		} else if (mutationMode === 'at-position') {
			// Use specific timeslot position
			const timeslotId = timeline.getTimeslotIdAt(targetTimeslotIndex);
			if (timeslotId) {
				ops.addMutation(
					selectedObject.id,
					timeslotId,
					newMutationLabel.trim(),
					{}
				);
			} else {
				// Create a new timeslot at this position
				ops.addMutationAtCurrent(
					selectedObject.id,
					newMutationLabel.trim(),
					{}
				);
			}
		} else if (mutationMode === 'below-card' && attachToCardId) {
			ops.addMutationBelowV2(
				selectedObject.id,
				attachToCardId,
				newMutationLabel.trim(),
				{}
			);
		}

		newMutationLabel = '';
		showMutationEditor = false;
	}

	// Delete mutation
	function handleDeleteMutation(id: string) {
		ops.deletePlacement(id);
	}

	// Delete object
	function handleDeleteObject() {
		if (selectedObject && confirm(`Delete "${selectedObject.name}"? This cannot be undone.`)) {
			const id = selectedObject.id;
			ui.select(null);
			ops.deleteObject(id);
		}
	}

	// Handle color change
	function handleColorChange(color: string | undefined) {
		if (selectedObject) {
			ops.updateObjectColor(selectedObject.id, color);
		}
	}

	// Handle icon change
	function handleIconChange(icon: string | undefined) {
		if (selectedObject) {
			ops.updateObjectIcon(selectedObject.id, icon);
		}
	}

	// Toggle thread
	function handleToggleThread() {
		if (selectedObject) {
			const willBecomeThread = !(selectedObject.isThread ?? false);
			ops.toggleObjectThread(selectedObject.id);

			// When enabling thread, make it visible on the timeline
			if (willBecomeThread) {
				timelineEditor.showThread(selectedObject.id);
			} else {
				timelineEditor.hideThread(selectedObject.id);
			}
		}
	}

	// Handle thread color change
	function handleThreadColorChange(color: string | undefined) {
		if (selectedObject && color) {
			ops.updateThreadColor(selectedObject.id, color);
		}
	}

	// Toggle card in thread
	function handleToggleCardInThread(cardId: string, isCurrentlyInThread: boolean) {
		if (!selectedObject) return;

		// Find placements for this card that could be associated with the thread
		const cardPlacements = timeline.getPlacementsForObject(cardId);

		if (isCurrentlyInThread) {
			// Remove all placements for this card from the thread
			for (const p of cardPlacements) {
				if (p.threadIds?.includes(selectedObject.id)) {
					ops.removePlacementFromThread(p.id, selectedObject.id);
				}
			}
		} else {
			// Add the card's creation placement to the thread, or create a dummy one
			const creationPlacement = cardPlacements.find((p) => p.type === 'creation');
			if (creationPlacement) {
				ops.addPlacementToThread(creationPlacement.id, selectedObject.id);
			} else if (cardPlacements.length > 0) {
				// Use first available placement
				ops.addPlacementToThread(cardPlacements[0].id, selectedObject.id);
			}
		}
	}

	// Navigate to card
	function handleNavigateToCard(cardId: string) {
		const index = timeline.getCardIndex(cardId);
		if (index >= 0) {
			timeline.setCursorIndex(index);
			timelineEditor.selectCard(cardId);
		}
	}

	// Toggle card expansion for subthread options
	function toggleCardExpanded(cardId: string) {
		const newSet = new Set(expandedCardIds);
		if (newSet.has(cardId)) {
			newSet.delete(cardId);
		} else {
			newSet.add(cardId);
		}
		expandedCardIds = newSet;
	}

	// Get the placement that associates a card with the current thread (read-only, no side effects)
	function findCardThreadPlacement(cardId: string): { placementId: string; subthreadIds: string[]; needsPromotion: boolean } | null {
		if (!selectedObject) return null;
		const threadId = selectedObject.id;

		// First check the card's own placements
		const cardPlacements = timeline.getPlacementsForObject(cardId);
		for (const p of cardPlacements) {
			if (p.threadIds?.includes(threadId)) {
				return { placementId: p.id, subthreadIds: p.subthreadIds ?? [], needsPromotion: false };
			}
		}

		// Card's own placements don't have this threadId
		// Check if the card is in the thread via mutations attached to it
		const creationPlacement = cardPlacements.find(p => p.type === 'creation');
		if (creationPlacement) {
			// In v3 model, check for mutations attached to this card
			const isInThreadViaMutation = timeline.allPlacements.some(p =>
				p.type === 'mutation' &&
				p.attachedToCardId === cardId &&
				p.threadIds?.includes(threadId)
			);

			if (isInThreadViaMutation) {
				// Card needs to be "promoted" to direct membership before subthread targeting works
				return { placementId: creationPlacement.id, subthreadIds: [], needsPromotion: true };
			}
		}

		return null;
	}

	// Ensure card has direct thread membership (call this before modifying subthreads)
	function ensureDirectThreadMembership(cardId: string): string | null {
		if (!selectedObject) return null;
		const result = findCardThreadPlacement(cardId);
		if (!result) return null;

		if (result.needsPromotion) {
			// Promote to direct membership
			timeline.addPlacementToThread(result.placementId, selectedObject.id);
		}
		return result.placementId;
	}

	// Get subthread targeting for a card (read-only, safe for templates)
	function getCardSubthreads(cardId: string): string[] {
		const result = findCardThreadPlacement(cardId);
		return result?.subthreadIds ?? [];
	}

	// Toggle a specific subthread for a card
	function toggleSubthreadForCard(cardId: string, sectionId: string) {
		const placementId = ensureDirectThreadMembership(cardId);
		if (!placementId) return;

		const currentSubthreads = getCardSubthreads(cardId);
		if (currentSubthreads.includes(sectionId)) {
			timeline.removeSubthreadFromPlacement(placementId, sectionId);
		} else {
			timeline.addSubthreadToPlacement(placementId, sectionId);
		}
	}

	// Check if card targets a specific subthread
	function cardTargetsSubthread(cardId: string, sectionId: string): boolean {
		return getCardSubthreads(cardId).includes(sectionId);
	}

	// Check if card targets full thread (no specific subthreads)
	function cardTargetsFullThread(cardId: string): boolean {
		return getCardSubthreads(cardId).length === 0;
	}

	// Set card to target full thread (clear subthread targeting)
	function setCardToFullThread(cardId: string) {
		const placementId = ensureDirectThreadMembership(cardId);
		if (placementId) {
			// Clear subthread targeting by setting to undefined
			timeline.updatePlacement(placementId, { subthreadIds: undefined });
		}
	}
</script>

<div class="properties-panel" class:collapsed={ui.propertiesPanelCollapsed}>
	<button class="collapse-toggle" onclick={() => ui.togglePropertiesPanel()}>
		<span class="collapse-icon">{ui.propertiesPanelCollapsed ? '<' : '>'}</span>
		{#if ui.propertiesPanelCollapsed}
			<span class="collapse-label">Properties</span>
		{/if}
	</button>

	{#if !ui.propertiesPanelCollapsed}
		{#if selectedObject && objectType && objectState}
			<div class="panel-content">
				<header class="panel-header">
					{#if editingName}
						<input
							class="name-input"
							type="text"
							bind:value={nameValue}
							onblur={handleSaveName}
							onkeydown={handleNameKeydown}
						/>
					{:else}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<h2 class="object-name" ondblclick={handleEditName}>{selectedObject.name}</h2>
					{/if}
					<span
						class="type-badge"
						style:background-color="{effectiveColor}20"
						style:color={effectiveColor}
					>
						{objectType.name}
					</span>
				</header>

				<CollapsibleSection title="Appearance">
					<div class="visual-row">
						<div class="visual-item">
							<span class="visual-label">Icon</span>
							<IconPicker
								value={selectedObject.icon}
								inheritedIcon={inheritedIcon}
								onSelect={handleIconChange}
							/>
						</div>
						<div class="visual-item">
							<span class="visual-label">Color</span>
							<ColorPicker
								value={selectedObject.color}
								inheritedColor={inheritedColor}
								onSelect={handleColorChange}
							/>
						</div>
					</div>
					<span class="visual-info">
						{#if isIconInherited && isColorInherited}
							Inheriting from {selectedObject.parentId ? 'parent' : 'type'}
						{:else if !isIconInherited && !isColorInherited}
							Using custom icon and color
						{:else}
							Mixed inheritance
						{/if}
					</span>
				</CollapsibleSection>

				{#if objectType?.isContentType}
					<CollapsibleSection title="Sections" badge={selectedObject.sections?.length ?? 0}>
						<div class="sections-list">
							{#if selectedObject.sections && selectedObject.sections.length > 0}
								{@const sorted = [...selectedObject.sections].sort((a, b) => a.sortOrder - b.sortOrder)}
								{#each sorted as section (section.id)}
									<div class="section-item">
										<span class="section-name">{section.name}</span>
										{#if selectedObject.sections.length > 1}
											<button
												class="section-remove-btn"
												onclick={() => objects.removeSection(selectedObject.id, section.id)}
												title="Remove section"
											>×</button>
										{/if}
									</div>
								{/each}
							{:else}
								<p class="sections-empty">No sections - using single content area</p>
							{/if}
						</div>
						<button
							class="add-section-btn"
							onclick={() => objects.addSection(selectedObject.id, `Section ${(selectedObject.sections?.length ?? 0) + 1}`)}
						>
							+ Add Section
						</button>
						{#if selectedObject.sections && selectedObject.sections.length > 0}
							<span class="sections-hint">
								Sections provide multiple text areas. When used as a thread, each section becomes a subthread.
							</span>
						{/if}
					</CollapsibleSection>
				{/if}

				<CollapsibleSection title="Timeline">
					<div class="toggle-row">
						<label class="toggle-label" class:disabled={selectedObject.isThread}>
							<input
								type="checkbox"
								class="toggle-input"
								checked={selectedObject.rendered}
								onchange={handleToggleRendered}
								disabled={selectedObject.isThread}
							/>
							<span class="toggle-switch"></span>
							<span class="toggle-text">Render as book section</span>
						</label>
						{#if selectedObject.isThread}
							<span class="toggle-hint">Disable thread first</span>
						{:else if selectedObject.rendered}
							<span class="toggle-hint rendered-hint">Appears as card on timeline and in book output</span>
						{/if}
					</div>

					<div class="toggle-row">
						<label class="toggle-label" class:disabled={selectedObject.rendered}>
							<input
								type="checkbox"
								class="toggle-input"
								checked={selectedObject.isThread ?? false}
								onchange={handleToggleThread}
								disabled={selectedObject.rendered}
							/>
							<span class="toggle-switch"></span>
							<span class="toggle-text">Use as narrative thread</span>
						</label>
						{#if selectedObject.rendered}
							<span class="toggle-hint">Remove from book first</span>
						{/if}
					</div>

					{#if selectedObject.isThread}
						<div class="thread-color-row">
							<span class="thread-color-label">Thread color:</span>
							<ColorPicker
								value={selectedObject.threadColor}
								inheritedColor={effectiveColor ?? undefined}
								onSelect={handleThreadColorChange}
							/>
						</div>

						{#if cardsInThread.length > 0}
							<div class="thread-group">
								<div class="thread-group-header">
									In Thread ({cardsInThread.length})
									{#if hasSubthreads}
										<span class="subthread-hint">Click to set subthread targeting</span>
									{/if}
								</div>
								<div class="thread-cards-list">
									{#each cardsInThread as card (card.id)}
										{@const isExpanded = expandedCardIds.has(card.id)}
										{@const cardSubthreads = getCardSubthreads(card.id)}
										{@const isFullThread = cardSubthreads.length === 0}
										<div class="thread-card-wrapper" class:expanded={isExpanded}>
											<div class="thread-card-row" class:has-subthreads={hasSubthreads}>
												<input
													type="checkbox"
													checked={true}
													onchange={() => handleToggleCardInThread(card.id, true)}
												/>
												<span class="card-icon">{objects.getEffectiveIcon(card.id)}</span>
												<button
													class="card-name"
													onclick={() => handleNavigateToCard(card.id)}
												>
													{card.name}
												</button>
												{#if hasSubthreads}
													<span class="subthread-badge" class:full={isFullThread}>
														{isFullThread ? 'Full' : cardSubthreads.length}
													</span>
													<button
														class="expand-btn"
														onclick={() => toggleCardExpanded(card.id)}
														title={isExpanded ? 'Collapse' : 'Expand subthread options'}
													>
														{isExpanded ? '▼' : '▶'}
													</button>
												{/if}
											</div>
											{#if hasSubthreads && isExpanded}
												<div class="subthread-options">
													<label class="subthread-option full-thread-option" class:active={isFullThread}>
														<input
															type="checkbox"
															checked={isFullThread}
															onchange={() => setCardToFullThread(card.id)}
														/>
														<span>All subthreads</span>
														<span class="option-hint">(default)</span>
													</label>
													<div class="subthread-divider">
														<span>or specific subthreads:</span>
													</div>
													{#each threadSections as section (section.id)}
														<label class="subthread-option specific-option" class:active={cardTargetsSubthread(card.id, section.id)}>
															<input
																type="checkbox"
																checked={cardTargetsSubthread(card.id, section.id)}
																onchange={() => toggleSubthreadForCard(card.id, section.id)}
															/>
															<span>{section.name}</span>
														</label>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if cardsNotInThread.length > 0}
							<div class="thread-group">
								<div class="thread-group-header">
									Available to Add ({cardsNotInThread.length})
								</div>
								<div class="thread-cards-list">
									{#each cardsNotInThread as card (card.id)}
										<div class="thread-card-row available">
											<input
												type="checkbox"
												checked={false}
												onchange={() => handleToggleCardInThread(card.id, false)}
											/>
											<span class="card-icon">{objects.getEffectiveIcon(card.id)}</span>
											<button
												class="card-name"
												onclick={() => handleNavigateToCard(card.id)}
											>
												{card.name}
											</button>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if cardsInThread.length === 0 && cardsNotInThread.length === 0}
							<p class="empty-thread">No cards on the timeline yet.</p>
						{/if}
					{/if}
				</CollapsibleSection>

				<CollapsibleSection
					title="Identity"
					defaultOpen={false}
					badge={selectedObject.aliases.length || undefined}
				>
					<div class="aliases-container">
						{#if selectedObject.aliases.length > 0}
							<div class="aliases-chips">
								{#each selectedObject.aliases as alias, i}
									<span class="alias-chip">
										{alias}
										<button
											class="alias-remove"
											onclick={() => handleRemoveAlias(i)}
											aria-label="Remove alias"
										>
											×
										</button>
									</span>
								{/each}
							</div>
						{/if}
						<div class="alias-add">
							<input
								type="text"
								placeholder="Add alias..."
								bind:value={newAlias}
								onkeydown={(e) => e.key === 'Enter' && handleAddAlias()}
							/>
							<button onclick={handleAddAlias} disabled={!newAlias.trim()}>+</button>
						</div>
					</div>
				</CollapsibleSection>

				{#if Object.keys(objectState.computedAttributes).length > 0}
					<CollapsibleSection
						title="State"
						defaultOpen={false}
						badge={Object.keys(objectState.computedAttributes).length}
					>
						<div class="attributes-list">
							{#each Object.entries(objectState.computedAttributes) as [key, value]}
								<div class="attribute-item">
									<span class="attribute-key">{key}:</span>
									<span class="attribute-value">{String(value)}</span>
								</div>
							{/each}
						</div>
					</CollapsibleSection>
				{/if}

				<CollapsibleSection
					title="Mutations"
					badge={objectState.mutations.length + objectState.futureMutations.length || undefined}
				>
					{#if showMutationEditor}
						<div class="mutation-editor">
							<div class="placement-mode">
								<label class="mode-option">
									<input
										type="radio"
										bind:group={mutationMode}
										value="at-cursor"
									/>
									<span>At cursor</span>
								</label>
								<label class="mode-option">
									<input
										type="radio"
										bind:group={mutationMode}
										value="at-position"
									/>
									<span>At position</span>
								</label>
								<label class="mode-option">
									<input
										type="radio"
										bind:group={mutationMode}
										value="below-card"
									/>
									<span>Below card</span>
								</label>
							</div>

							{#if mutationMode === 'at-cursor'}
								<div class="position-hint">
									At position {timeline.cursorIndex + 1}
								</div>
							{:else if mutationMode === 'at-position'}
								<div class="position-selector">
									<label>Position:</label>
									<select bind:value={targetTimeslotIndex}>
										{#each timeline.orderedTimeslots as ts, i (ts.timeslotId)}
											<option value={i}>
												{i + 1}
												{#if ts.cards.length > 0}
													- {ts.cards.map(c => c.name).join(', ')}
												{/if}
											</option>
										{/each}
										<option value={timeline.timeslotOrder.length}>
											{timeline.timeslotOrder.length + 1} (new position)
										</option>
									</select>
								</div>
							{:else if mutationMode === 'below-card'}
								<select
									class="card-select"
									bind:value={attachToCardId}
								>
									<option value={null}>Select card...</option>
									{#each timeline.renderedObjects as card}
										<option value={card.id}>{card.name}</option>
									{/each}
								</select>
							{/if}

							<input
								type="text"
								class="mutation-label-input"
								placeholder="Mutation label..."
								bind:value={newMutationLabel}
								onkeydown={(e) => e.key === 'Enter' && handleAddMutation()}
							/>
							<div class="mutation-editor-actions">
								<button
									class="btn-primary"
									onclick={handleAddMutation}
									disabled={!newMutationLabel.trim() ||
										(mutationMode === 'below-card' && !attachToCardId)}
								>
									Add
								</button>
								<button onclick={() => (showMutationEditor = false)}>Cancel</button>
							</div>
						</div>
					{:else}
						<button class="add-mutation-btn" onclick={() => (showMutationEditor = true)}>
							+ Add mutation
						</button>
					{/if}

					<!-- Always show Initial state option -->
					<div class="mutations-list">
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="mutation-item initial"
							class:active={ui.activeMutationId === null}
							onclick={() => {
								ui.clearActiveMutation();
								timeline.setCursorIndex(0);
							}}
						>
							<span class="mutation-position">@0</span>
							<span class="mutation-label">Initial state</span>
						</div>
					</div>

					{#if objectState.mutations.length > 0}
						<div class="mutations-list">
							<div class="mutations-group">
								<span class="mutations-label">Applied</span>
								{#each objectState.mutations as mutation}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="mutation-item applied"
										class:active={ui.activeMutationId === mutation.id}
										onclick={() => handleJumpToMutation(mutation.id, mutation.attachedToCardId)}
									>
										<span class="mutation-position">
											{#if mutation.attachedToCardId}
												↳
											{:else}
												@{timeline.getTimeslotIndex(mutation.timeslotId) + 1}
											{/if}
										</span>
										<span class="mutation-label">{mutation.mutation?.label}</span>
										<button
											class="mutation-delete"
											onclick={(e) => {
												e.stopPropagation();
												handleDeleteMutation(mutation.id);
											}}
										>
											×
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if objectState.futureMutations.length > 0}
						<div class="mutations-list">
							<div class="mutations-group future">
								<span class="mutations-label">Future</span>
								{#each objectState.futureMutations as mutation}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="mutation-item future"
										class:active={ui.activeMutationId === mutation.id}
										onclick={() => handleJumpToMutation(mutation.id, mutation.attachedToCardId)}
									>
										<span class="mutation-position">
											{#if mutation.attachedToCardId}
												↳
											{:else}
												@{timeline.getTimeslotIndex(mutation.timeslotId) + 1}
											{/if}
										</span>
										<span class="mutation-label">{mutation.mutation?.label}</span>
										<button
											class="mutation-delete"
											onclick={(e) => {
												e.stopPropagation();
												handleDeleteMutation(mutation.id);
											}}
										>
											×
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</CollapsibleSection>

				<div class="danger-zone">
					<button class="delete-btn" onclick={handleDeleteObject}>Delete object</button>
				</div>
			</div>
		{:else}
			<div class="empty-state">
				<p class="empty-text">Select an object to view its properties</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	.properties-panel {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: var(--space-md);
		overflow-y: auto;
		background-color: var(--surface-raised);
		border-left: 1px solid var(--border-subtle);
		transition:
			width var(--transition-normal),
			padding var(--transition-normal);
	}

	.properties-panel.collapsed {
		width: 40px;
		min-width: 40px;
		padding: var(--space-sm);
		overflow: hidden;
	}

	.collapse-toggle {
		position: absolute;
		top: var(--space-sm);
		left: var(--space-sm);
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-xs);
		background: transparent;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--text-secondary);
		font-size: var(--font-size-sm);
		transition: background-color var(--transition-fast);
		z-index: 10;
	}

	.collapse-toggle:hover {
		background-color: var(--hover-bg);
	}

	.collapse-icon {
		width: 16px;
		text-align: center;
		font-weight: 600;
	}

	.collapse-label {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		font-size: var(--font-size-xs);
		font-weight: 500;
		color: var(--text-muted);
		padding: var(--space-sm) 0;
	}

	.collapsed .collapse-toggle {
		position: static;
		flex-direction: column;
		width: 100%;
		border: none;
		padding: var(--space-xs) 0;
	}

	.panel-content {
		margin-top: calc(32px + var(--space-sm));
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		margin-top: calc(32px + var(--space-sm));
	}

	.empty-text {
		color: var(--text-muted);
		font-size: var(--font-size-sm);
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
		padding-bottom: var(--space-md);
		border-bottom: 1px solid var(--border-subtle);
	}

	.object-name {
		flex: 1;
		font-size: var(--font-size-lg);
		font-weight: 600;
		margin: 0;
		cursor: pointer;
	}

	.object-name:hover {
		color: var(--text-secondary);
	}

	.name-input {
		flex: 1;
		font-size: var(--font-size-lg);
		font-weight: 600;
		padding: var(--space-xs);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		background-color: var(--surface-base);
	}

	.type-badge {
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
		font-weight: 500;
		flex-shrink: 0;
	}

	/* Visual/Appearance Section */
	.visual-row {
		display: flex;
		gap: var(--space-lg);
		margin-bottom: var(--space-sm);
	}

	.visual-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.visual-label {
		font-size: var(--font-size-xs);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.visual-info {
		font-size: var(--font-size-sm);
		color: var(--text-muted);
	}

	/* Toggle Switches */
	.toggle-row {
		margin-bottom: var(--space-sm);
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		cursor: pointer;
		font-size: var(--font-size-sm);
	}

	.toggle-input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.toggle-switch {
		position: relative;
		width: 36px;
		height: 20px;
		background: var(--surface-sunken);
		border-radius: 10px;
		border: 1px solid var(--border-default);
		transition: all var(--transition-fast);
		flex-shrink: 0;
	}

	.toggle-switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		background: white;
		border-radius: 50%;
		box-shadow: var(--shadow-sm);
		transition: transform var(--transition-fast);
	}

	.toggle-input:checked + .toggle-switch {
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.toggle-input:checked + .toggle-switch::after {
		transform: translateX(16px);
	}

	.toggle-input:focus-visible + .toggle-switch {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.toggle-text {
		color: var(--text-primary);
	}

	.toggle-label.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-label.disabled .toggle-switch {
		background: var(--surface-sunken);
		border-color: var(--border-subtle);
	}

	.toggle-hint {
		display: block;
		font-size: var(--font-size-xs);
		color: var(--text-muted);
		margin-left: calc(36px + var(--space-sm));
		margin-top: 2px;
	}

	.toggle-hint.rendered-hint {
		color: var(--color-primary);
		opacity: 0.8;
	}

	/* Thread Section */
	.thread-color-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin: var(--space-sm) 0;
		padding-left: calc(36px + var(--space-sm));
	}

	.thread-color-label {
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
	}

	.thread-group {
		margin-top: var(--space-md);
	}

	.thread-group-header {
		font-size: var(--font-size-xs);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--space-xs);
		padding-bottom: var(--space-xs);
		border-bottom: 1px solid var(--border-subtle);
	}

	.thread-cards-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 150px;
		overflow-y: auto;
	}

	.thread-card-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		transition: background-color var(--transition-fast);
	}

	.thread-card-row:hover {
		background-color: var(--hover-bg);
	}

	.thread-card-row.available {
		opacity: 0.7;
	}

	.thread-card-row input[type='checkbox'] {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.card-icon {
		font-size: var(--font-size-sm);
	}

	.card-name {
		flex: 1;
		text-align: left;
		font-size: var(--font-size-sm);
		color: var(--text-primary);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: none;
	}

	.card-name:hover {
		text-decoration: underline;
		color: var(--color-primary);
	}

	.empty-thread {
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		margin: var(--space-sm) 0;
	}

	/* Subthread targeting UI */
	.subthread-hint {
		font-size: var(--font-size-xs);
		font-weight: 400;
		color: var(--text-muted);
		margin-left: auto;
	}

	.thread-card-wrapper {
		border-radius: var(--radius-sm);
		transition: background-color var(--transition-fast);
	}

	.thread-card-wrapper.expanded {
		background-color: var(--surface-sunken);
	}

	.thread-card-row.has-subthreads {
		cursor: pointer;
	}

	.subthread-badge {
		font-size: var(--font-size-xs);
		font-weight: 500;
		padding: 1px 6px;
		border-radius: 8px;
		background-color: var(--color-primary);
		color: white;
		flex-shrink: 0;
	}

	.subthread-badge.full {
		background-color: var(--surface-sunken);
		color: var(--text-secondary);
	}

	.expand-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		padding: 0;
		font-size: 0.5rem;
		color: var(--text-tertiary);
		background: transparent;
		border: none;
		border-radius: 2px;
		cursor: pointer;
		flex-shrink: 0;
		transition: all 0.15s ease;
	}

	.expand-btn:hover {
		color: var(--text-primary);
		background: var(--hover-bg);
	}

	.subthread-options {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-xs) var(--space-sm);
		padding-left: calc(14px + var(--space-sm) + var(--space-sm));
		border-top: 1px solid var(--border-subtle);
	}

	.subthread-option {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: 2px 0;
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		cursor: pointer;
	}

	.subthread-option:hover {
		color: var(--text-primary);
	}

	.subthread-option input[type='radio'],
	.subthread-option input[type='checkbox'] {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.subthread-option.active {
		color: var(--text-primary);
		font-weight: 500;
	}

	.subthread-option.full-thread-option {
		padding-bottom: var(--space-xs);
	}

	.option-hint {
		font-size: var(--font-size-xs);
		color: var(--text-muted);
		font-weight: 400;
	}

	.subthread-divider {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs) 0;
		margin-bottom: var(--space-xs);
	}

	.subthread-divider span {
		font-size: var(--font-size-xs);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.subthread-option.specific-option {
		padding-left: var(--space-sm);
	}

	/* Aliases Section */
	.aliases-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.aliases-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.alias-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: 2px var(--space-sm);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
	}

	.alias-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		padding: 0;
		font-size: 12px;
		line-height: 1;
		color: var(--text-muted);
		background: none;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.alias-remove:hover {
		color: var(--color-error);
		background: var(--hover-bg);
	}

	.alias-add {
		display: flex;
		gap: var(--space-xs);
	}

	.alias-add input {
		flex: 1;
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--font-size-sm);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background-color: var(--surface-base);
	}

	.alias-add button {
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--font-size-sm);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background-color: var(--surface-base);
		cursor: pointer;
	}

	.alias-add button:hover:not(:disabled) {
		background-color: var(--hover-bg);
	}

	.alias-add button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Attributes Section */
	.attributes-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.attribute-item {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		background-color: var(--surface-sunken);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		font-family: var(--font-mono);
	}

	.attribute-key {
		color: var(--text-secondary);
	}

	.attribute-value {
		color: var(--text-primary);
	}

	/* Mutations Section */
	.add-mutation-btn {
		width: 100%;
		padding: var(--space-sm);
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		background-color: var(--surface-sunken);
		border: 1px dashed var(--border-subtle);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
		margin-bottom: var(--space-sm);
	}

	.add-mutation-btn:hover {
		background-color: var(--hover-bg);
		border-style: solid;
	}

	.mutation-editor {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-sm);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-sm);
	}

	.placement-mode {
		display: flex;
		gap: var(--space-md);
	}

	.mode-option {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.card-select {
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--font-size-sm);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background-color: var(--surface-base);
	}

	.position-hint {
		font-size: var(--font-size-xs);
		color: var(--text-muted);
	}

	.position-selector {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		font-size: var(--font-size-xs);
	}

	.position-selector label {
		color: var(--text-secondary);
	}

	.position-selector select {
		flex: 1;
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--font-size-xs);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background-color: var(--surface-base);
		color: var(--text-primary);
	}

	.mutation-label-input {
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--font-size-sm);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background-color: var(--surface-base);
	}

	.mutation-editor-actions {
		display: flex;
		gap: var(--space-xs);
	}

	.mutation-editor-actions button {
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--font-size-sm);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background-color: var(--surface-base);
		cursor: pointer;
	}

	.mutation-editor-actions button:hover:not(:disabled) {
		background-color: var(--hover-bg);
	}

	.mutation-editor-actions button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: var(--color-primary) !important;
		border-color: var(--color-primary) !important;
		color: white !important;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: var(--color-primary-hover) !important;
	}

	.mutations-list {
		margin-bottom: var(--space-sm);
	}

	.mutations-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.mutations-label {
		font-size: var(--font-size-xs);
		color: var(--text-muted);
		margin-bottom: var(--space-xs);
	}

	.mutation-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-xs) var(--space-sm);
		background-color: var(--surface-sunken);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		text-align: left;
		cursor: pointer;
		transition: background-color var(--transition-fast);
	}

	.mutation-item:hover {
		background-color: var(--hover-bg);
	}

	.mutation-item.applied {
		border-left: 3px solid var(--color-primary);
	}

	.mutation-item.future {
		border-left: 3px solid var(--border-subtle);
		border-style: dashed;
		border-left-style: dashed;
	}

	.mutation-item.active {
		background-color: var(--color-primary);
		color: white;
		border-left-color: white;
	}

	.mutation-item.active .mutation-position,
	.mutation-item.active .mutation-label {
		color: white;
	}

	.mutation-item.initial {
		border-left: 3px solid var(--text-muted);
		font-style: italic;
	}

	.mutation-position {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.mutation-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mutation-delete {
		padding: 0 var(--space-xs);
		font-size: 14px;
		color: var(--text-muted);
		background: none;
		border: none;
		cursor: pointer;
		opacity: 0;
		transition: opacity var(--transition-fast);
	}

	.mutation-item:hover .mutation-delete {
		opacity: 1;
	}

	.mutation-delete:hover {
		color: var(--color-error);
	}

	/* Danger Zone */
	.danger-zone {
		margin-top: auto;
		padding-top: var(--space-md);
		border-top: 1px solid var(--border-subtle);
	}

	.delete-btn {
		width: 100%;
		padding: var(--space-sm);
		font-size: var(--font-size-sm);
		color: var(--color-error);
		background-color: transparent;
		border: 1px solid var(--color-error);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.delete-btn:hover {
		background-color: var(--color-error);
		color: white;
	}

	/* Sections management */
	.sections-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin-bottom: var(--space-sm);
	}

	.section-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-xs) var(--space-sm);
		background-color: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}

	.section-name {
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--text-primary);
	}

	.section-remove-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		font-size: 14px;
		color: var(--text-muted);
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		opacity: 0;
		transition: all var(--transition-fast);
	}

	.section-item:hover .section-remove-btn {
		opacity: 1;
	}

	.section-remove-btn:hover {
		color: var(--color-error, #ef4444);
		background-color: color-mix(in srgb, var(--color-error, #ef4444) 10%, transparent);
	}

	.sections-empty {
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		text-align: center;
		padding: var(--space-sm);
	}

	.add-section-btn {
		width: 100%;
		padding: var(--space-sm);
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		background: none;
		border: 1px dashed var(--border-subtle);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.add-section-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
		border-style: solid;
	}

	.sections-hint {
		display: block;
		margin-top: var(--space-sm);
		font-size: var(--font-size-xs);
		color: var(--text-muted);
		line-height: 1.4;
	}
</style>
