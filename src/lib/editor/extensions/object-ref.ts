/**
 * ObjectRef TipTap Extension
 *
 * Inline node for referencing other objects in the project.
 * Typing [[text]] creates a reference node that displays as a colored chip.
 */

import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface ObjectRefOptions {
  /**
   * Callback to resolve an object by name or alias
   * Returns { id, name, color } or null if not found
   */
  resolveObject: (text: string) => { id: string; name: string; color: string } | null;

  /**
   * Callback when a reference is clicked (left-click)
   */
  onRefClick?: (objectId: string) => void;

  /**
   * Callback when a reference is right-clicked (context menu)
   * Provides objectId, displayText, position in editor, and mouse coordinates
   */
  onRefRightClick?: (data: {
    objectId: string;
    displayText: string;
    pos: number;
    clientX: number;
    clientY: number;
  }) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    objectRef: {
      /**
       * Insert an object reference
       */
      insertObjectRef: (options: { objectId: string; displayText: string }) => ReturnType;
    };
  }
}

export const ObjectRef = Node.create<ObjectRefOptions>({
  name: 'objectRef',

  group: 'inline',
  inline: true,
  atom: true, // Cannot be edited directly, treated as single unit
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      resolveObject: () => null,
      onRefClick: undefined,
      onRefRightClick: undefined,
    };
  },

  addAttributes() {
    return {
      objectId: {
        default: null,
        parseHTML: element => element.getAttribute('data-object-id'),
        renderHTML: attributes => {
          if (!attributes.objectId) return {};
          return { 'data-object-id': attributes.objectId };
        },
      },
      displayText: {
        default: '',
        parseHTML: element => element.getAttribute('data-display-text') || element.textContent,
        renderHTML: attributes => {
          return { 'data-display-text': attributes.displayText };
        },
      },
      status: {
        default: 'resolved', // resolved | tentative | unknown
        parseHTML: element => element.getAttribute('data-status') || 'resolved',
        renderHTML: attributes => {
          return { 'data-status': attributes.status };
        },
      },
      color: {
        default: '#3b82f6',
        parseHTML: element => element.getAttribute('data-color') || '#3b82f6',
        renderHTML: attributes => {
          return { 'data-color': attributes.color };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="object-ref"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const status = node.attrs.status;
    const color = node.attrs.color;

    // Style based on status
    let style = '';
    if (status === 'resolved') {
      style = `background-color: ${color}20; color: ${color}; border-color: ${color}40;`;
    } else if (status === 'tentative') {
      style = `background-color: #f59e0b20; color: #f59e0b; border-color: #f59e0b40; font-style: italic;`;
    } else {
      style = `background-color: #ef444420; color: #ef4444; border-color: #ef444440; text-decoration: line-through;`;
    }

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'object-ref',
        'class': 'object-ref-node',
        'style': style,
      }),
      node.attrs.displayText,
    ];
  },

  addCommands() {
    return {
      insertObjectRef:
        ({ objectId, displayText }) =>
        ({ commands }) => {
          // Try to resolve to get object info, but KEEP the passed displayText
          const resolved = this.options.resolveObject(displayText);
          return commands.insertContent({
            type: this.name,
            attrs: {
              objectId: resolved?.id ?? objectId,
              displayText: displayText, // Always use the passed displayText (could be alias)
              status: resolved ? 'resolved' : (objectId ? 'resolved' : 'unknown'),
              color: resolved?.color ?? '#3b82f6',
            },
          });
        },
    };
  },

  addInputRules() {
    const type = this.type;
    const resolveObject = this.options.resolveObject;

    return [
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const text = match[1];
          const resolved = resolveObject(text);

          const { tr } = state;
          const start = range.from;
          const end = range.to;

          tr.replaceWith(start, end, type.create({
            objectId: resolved?.id ?? null,
            displayText: resolved?.name ?? text,
            status: resolved ? 'resolved' : 'tentative',
            color: resolved?.color ?? '#64748b',
          }));
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: new PluginKey('objectRefClick'),
        props: {
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;
            if (target.classList.contains('object-ref-node')) {
              const objectId = target.getAttribute('data-object-id');
              if (objectId && options.onRefClick) {
                options.onRefClick(objectId);
                return true;
              }
            }
            return false;
          },
          handleDOMEvents: {
            contextmenu(view, event) {
              const target = event.target as HTMLElement;
              if (target.classList.contains('object-ref-node')) {
                event.preventDefault();
                const objectId = target.getAttribute('data-object-id');
                const displayText = target.getAttribute('data-display-text') || target.textContent || '';

                if (objectId && options.onRefRightClick) {
                  // Get the position of the node in the document
                  const pos = view.posAtDOM(target, 0);
                  options.onRefRightClick({
                    objectId,
                    displayText,
                    pos,
                    clientX: event.clientX,
                    clientY: event.clientY,
                  });
                  return true;
                }
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});

export default ObjectRef;
