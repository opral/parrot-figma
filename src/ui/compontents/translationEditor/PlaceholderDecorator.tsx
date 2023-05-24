// eslint-disable-next-line max-classes-per-file
import {
  Decoration,
  DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { Placeholder, PlaceholderType, UITranslationKey } from '../../../lib/keystore/UITranslationKey';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';

class PlaceholderWidget extends WidgetType {
  placeholder: Placeholder;

  content: string;

  constructor(inTextPlaceholder: Placeholder, derivedPlaceholder: Placeholder | undefined) {
    super();
    this.placeholder = inTextPlaceholder;

    const name = this.placeholder.named ? this.placeholder.name : '?';

    if (this.placeholder.type === PlaceholderType.float) {
      this.content = `${this.placeholder.specifiedArgumentPosition}:${this.placeholder.name}:f.${this.placeholder.decimalPlaces}`;
    } else if (this.placeholder.type === PlaceholderType.integer) {
      this.content = `${this.placeholder.specifiedArgumentPosition}:${name}:i`;
    } else {
      this.content = `${this.placeholder.specifiedArgumentPosition}:${name}`;
    }
  }

  eq(other: any) {
    return this.content === other.content;
  }

  toDOM() {
    const elt = document.createElement('span');
    elt.style.cssText = `
      border: 1px solid blue;
      border-radius: 4px;
      padding: 0 3px;
      background: lightblue;`;
    elt.textContent = this.content;
    return elt;
  }

  // eslint-disable-next-line class-methods-use-this
  ignoreEvent() {
    return false;
  }
}

/**
Helper class used to make it easier to maintain decorations on
visible code that matches a given regular expression. To be used
in a [view plugin](https://codemirror.net/6/docs/ref/#view.ViewPlugin). Instances of this object
represent a matching configuration.
*/
export default function placeholderDecorator(keyStore: MemoryTranslationKeyStore, keyName: string | undefined) {
  return ViewPlugin.fromClass(class {
    placeholders: DecorationSet;

    constructor(view: EditorView) {
      this.placeholders = this.createDeco(view);
    }

    update(update: ViewUpdate) {
      this.placeholders = this.updateDeco(update, this.placeholders);
    }

    /**
    Compute the full set of decorations for matches in the given
    view's viewport. You'll want to call this when initializing your
    plugin.
    */
    // eslint-disable-next-line class-methods-use-this
    createDeco(view: EditorView) {
      const build = new RangeSetBuilder();
      const add = build.add.bind(build);

      const derivedPlaceholders = keyName ? keyStore.getKey(keyName)?.getPlaceholders() : undefined;

      // editors are always show the whole text - we optimze later if needed
      const text = view.state.doc.toString();

      const cursorPos = view.state.selection.ranges[0].from;

      const placeholders = UITranslationKey.extractPlaceholdersInText(text);
      for (const placeholder of placeholders) {
        // we do not mask if the cursor is placed within a placeholder
        if (!(cursorPos > placeholder.positionInString && cursorPos < (placeholder.positionInString + placeholder.length))) {
          add(placeholder.positionInString, placeholder.positionInString + placeholder.length, Decoration.replace({
            widget: new PlaceholderWidget(placeholder, derivedPlaceholders?.[placeholder.name]),
          }));
        }
      }
      return build.finish() as DecorationSet;
    }

    /**
    Update a set of decorations for a view update. `deco` _must_ be
    the set of decorations produced by _this_ `MatchDecorator` for
    the view state before the update.
    */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateDeco(update: ViewUpdate, _deco: DecorationSet): DecorationSet {
      return this.createDeco(update.view);
    }
  }, {
    decorations: (instance) => instance.placeholders,
    // provide: (plugin) => EditorView.atomicRanges.of((view) => view.plugin(plugin)?.placeholders || Decoration.none),
  });
}
