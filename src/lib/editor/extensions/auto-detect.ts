/**
 * AutoDetect TipTap Extension
 *
 * Automatically detects typed words that match object names/aliases
 * and offers to convert them to ObjectRef nodes.
 *
 * - Shows dotted underline decoration on matches
 * - Tab/Enter accepts the first match
 * - Click shows popup for multiple matches
 * - Escape dismisses the suggestion
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';

export interface AutoDetectMatch {
  id: string;
  name: string;
  color: string;
}

export interface AutoDetectOptions {
  /**
   * Callback to get matching objects for a word
   */
  getMatches: (word: string) => AutoDetectMatch[];

  /**
   * Callback when a match is accepted
   * @param match - The selected match
   * @param range - Position in document
   * @param typedWord - The original word that was typed (to preserve as display text)
   */
  onAccept: (match: AutoDetectMatch, range: { from: number; to: number }, typedWord: string) => void;

  /**
   * Callback to show popup for multiple matches
   */
  onShowPopup?: (
    matches: AutoDetectMatch[],
    range: { from: number; to: number },
    coords: { x: number; y: number },
    typedWord: string
  ) => void;

  /**
   * Callback when suggestion is dismissed
   */
  onDismiss?: () => void;

  /**
   * Debounce time in ms (default: 150)
   */
  debounceMs?: number;

  /**
   * Minimum word length to trigger detection (default: 2)
   */
  minWordLength?: number;
}

export const autoDetectPluginKey = new PluginKey('autoDetect');

interface AutoDetectState {
  active: boolean;
  word: string;
  from: number;
  to: number;
  matches: AutoDetectMatch[];
  decorations: DecorationSet;
}

/**
 * Find potential text to match at cursor position
 * Supports multi-word aliases like "Mr. Baggins"
 */
function findCurrentWord(
  state: { doc: { resolve: (pos: number) => { parent: { textBetween: (from: number, to: number) => string }; parentOffset: number } } },
  pos: number,
  minLength: number,
  getMatches: (word: string) => AutoDetectMatch[]
): { word: string; from: number; to: number; matches: AutoDetectMatch[] } | null {
  const $pos = state.doc.resolve(pos);
  const textBefore = $pos.parent.textBetween(0, $pos.parentOffset);

  // First try: match just the last word (most common case)
  const singleWordMatch = textBefore.match(/[\w]+$/);
  if (singleWordMatch && singleWordMatch[0].length >= minLength) {
    const matches = getMatches(singleWordMatch[0]);
    if (matches.length > 0) {
      return {
        word: singleWordMatch[0],
        from: pos - singleWordMatch[0].length,
        to: pos,
        matches,
      };
    }
  }

  // Second try: match multi-word patterns (for aliases like "Mr. Baggins")
  // Match word characters, spaces, dots, apostrophes at the end
  const multiWordMatch = textBefore.match(/[\w][\w\s\.\-']*[\w]$/);
  if (multiWordMatch && multiWordMatch[0].length >= minLength) {
    // Try progressively shorter suffixes to find a match
    const candidate = multiWordMatch[0];
    // Split by word boundaries and try combinations
    const words = candidate.split(/\s+/);

    // Try from longest to shortest (last N words)
    for (let i = 0; i < words.length; i++) {
      const phrase = words.slice(i).join(' ');
      if (phrase.length >= minLength) {
        const matches = getMatches(phrase);
        if (matches.length > 0) {
          const phraseStart = textBefore.lastIndexOf(phrase);
          return {
            word: phrase,
            from: pos - (textBefore.length - phraseStart),
            to: pos,
            matches,
          };
        }
      }
    }
  }

  return null;
}

export const AutoDetect = Extension.create<AutoDetectOptions>({
  name: 'autoDetect',

  addOptions() {
    return {
      getMatches: () => [],
      onAccept: () => {},
      onShowPopup: undefined,
      onDismiss: undefined,
      debounceMs: 150,
      minWordLength: 2,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return [
      new Plugin({
        key: autoDetectPluginKey,

        state: {
          init(): AutoDetectState {
            return {
              active: false,
              word: '',
              from: 0,
              to: 0,
              matches: [],
              decorations: DecorationSet.empty,
            };
          },

          apply(tr, state, _oldState, newState): AutoDetectState {
            // If there's metadata to clear, do so
            const meta = tr.getMeta(autoDetectPluginKey);
            if (meta?.clear) {
              return {
                active: false,
                word: '',
                from: 0,
                to: 0,
                matches: [],
                decorations: DecorationSet.empty,
              };
            }

            // If metadata has new state, use it
            if (meta?.state) {
              return meta.state;
            }

            // Map decorations through document changes
            if (tr.docChanged) {
              return {
                ...state,
                decorations: state.decorations.map(tr.mapping, tr.doc),
              };
            }

            return state;
          },
        },

        props: {
          decorations(state) {
            const pluginState = autoDetectPluginKey.getState(state) as AutoDetectState;
            return pluginState?.decorations ?? DecorationSet.empty;
          },

          handleKeyDown(view: EditorView, event: KeyboardEvent) {
            const state = autoDetectPluginKey.getState(view.state) as AutoDetectState;
            if (!state?.active) return false;

            // Tab or Enter accepts first match
            if (event.key === 'Tab' || event.key === 'Enter') {
              if (state.matches.length > 0) {
                event.preventDefault();
                options.onAccept(state.matches[0], { from: state.from, to: state.to }, state.word);

                // Clear the state
                const tr = view.state.tr.setMeta(autoDetectPluginKey, { clear: true });
                view.dispatch(tr);
                return true;
              }
            }

            // Escape dismisses
            if (event.key === 'Escape') {
              event.preventDefault();
              const tr = view.state.tr.setMeta(autoDetectPluginKey, { clear: true });
              view.dispatch(tr);
              options.onDismiss?.();
              return true;
            }

            return false;
          },

          handleClick(view: EditorView, _pos: number, event: MouseEvent) {
            const target = event.target as HTMLElement;
            if (target.classList.contains('auto-detect-hint')) {
              const state = autoDetectPluginKey.getState(view.state) as AutoDetectState;
              if (state?.active && state.matches.length > 0) {
                event.preventDefault();

                if (state.matches.length === 1) {
                  // Single match - accept directly
                  options.onAccept(state.matches[0], { from: state.from, to: state.to }, state.word);
                } else if (options.onShowPopup) {
                  // Multiple matches - show popup
                  const rect = target.getBoundingClientRect();
                  options.onShowPopup(state.matches, { from: state.from, to: state.to }, {
                    x: rect.left,
                    y: rect.bottom + 4,
                  }, state.word);
                }

                return true;
              }
            }
            return false;
          },
        },

        view(view: EditorView) {
          const updateDetection = () => {
            const { state } = view;
            const { selection } = state;

            // Helper to clear state and dismiss popup
            const clearDetection = () => {
              const currentState = autoDetectPluginKey.getState(state) as AutoDetectState;
              if (currentState?.active) {
                const tr = state.tr.setMeta(autoDetectPluginKey, { clear: true });
                view.dispatch(tr);
                options.onDismiss?.();
              }
            };

            // Only detect when cursor is at a single point (not selecting)
            if (!selection.empty) {
              clearDetection();
              return;
            }

            // Find word and matches together (supports multi-word aliases)
            const wordInfo = findCurrentWord(
              state,
              selection.from,
              options.minWordLength ?? 2,
              options.getMatches
            );

            if (!wordInfo || wordInfo.matches.length === 0) {
              clearDetection();
              return;
            }

            // Create decoration
            const decoration = Decoration.inline(wordInfo.from, wordInfo.to, {
              class: 'auto-detect-hint',
              'data-matches': String(wordInfo.matches.length),
            });

            const newState: AutoDetectState = {
              active: true,
              word: wordInfo.word,
              from: wordInfo.from,
              to: wordInfo.to,
              matches: wordInfo.matches,
              decorations: DecorationSet.create(state.doc, [decoration]),
            };

            const tr = state.tr.setMeta(autoDetectPluginKey, { state: newState });
            view.dispatch(tr);

            // Auto-show popup
            if (options.onShowPopup) {
              // Get coordinates for popup positioning
              const coords = view.coordsAtPos(wordInfo.from);
              options.onShowPopup(wordInfo.matches, { from: wordInfo.from, to: wordInfo.to }, {
                x: coords.left,
                y: coords.bottom + 4,
              }, wordInfo.word);
            }
          };

          return {
            update(view: EditorView, prevState) {
              // Only run detection if selection or content changed
              if (
                view.state.selection.eq(prevState.selection) &&
                view.state.doc.eq(prevState.doc)
              ) {
                return;
              }

              // Debounce the detection
              if (debounceTimer) {
                clearTimeout(debounceTimer);
              }
              debounceTimer = setTimeout(updateDetection, options.debounceMs ?? 150);
            },

            destroy() {
              if (debounceTimer) {
                clearTimeout(debounceTimer);
              }
            },
          };
        },
      }),
    ];
  },
});

export default AutoDetect;
