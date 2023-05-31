// eslint-disable-next-line max-classes-per-file
import * as React from 'react';
import {
  Decoration,
  DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import ReactDOMServer from 'react-dom/server';
import { UITranslationKey } from '../../../lib/keystore/UITranslationKey';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import { PlaceholderView, PlaceholderViewProps } from './PlaceholderView';
import { isVisibleNode } from '@figma-plugin/helpers';

class PlaceholderWidget extends WidgetType {
  contentHtml: string;

  constructor(placeholderProps: PlaceholderViewProps) {
    super();
    this.contentHtml = ReactDOMServer.renderToString(<PlaceholderView
      name={placeholderProps.name}
      type={placeholderProps.type}
      specifiedArgumentPositon={placeholderProps.specifiedArgumentPositon}
      decimalPlaces={placeholderProps.decimalPlaces}
      derivedArgumentPosition={placeholderProps.derivedArgumentPosition}
      fillIn={placeholderProps.fillIn}
      selected={placeholderProps.selected}
    />);
  }

  eq(other: any) {
    return this.contentHtml === other.contentHtml;
  }

  toDOM() {
    const helperContainer = document.createElement('span');
    helperContainer.innerHTML = this.contentHtml;
    return helperContainer.firstChild as HTMLElement;
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

      const derivedPlaceholders = keyName ? keyStore.getKey(keyName)?.placeholders : undefined;

      // editors are always show the whole text - we optimze later if needed
      const text = view.state.doc.toString();

      const cursorPos = view.state.selection.ranges[0].from;

      const placeholders = UITranslationKey.extractPlaceholdersInText(text);
      for (const placeholder of placeholders) {
        const fixedPosition = 3; // TODO source this from the keys parameters instead
        // we do not mask if the cursor is placed within a placeholder
        if (!(cursorPos > placeholder.positionInString && cursorPos < (placeholder.positionInString + placeholder.length))) {
          const placeHolderEnd = placeholder.positionInString + placeholder.length;
          let selected = false;
          for (const range of view.state.selection.ranges) {
            if (range.to !== range.from && placeholder.positionInString <= range.to && placeHolderEnd >= range.from) {
              console.log('placeholder.positionInString' + placeholder.positionInString);
              console.log('placeHolderEnd' + placeHolderEnd);
              console.log(range);
              // Overlapping detected
              selected = true;
            }
          }

          add(placeholder.positionInString, placeHolderEnd, Decoration.replace({
            widget: new PlaceholderWidget({
              name: placeholder.name,
              type: placeholder.type,
              decimalPlaces: placeholder.decimalPlaces,
              specifiedArgumentPositon: placeholder.specifiedArgumentPosition,
              derivedArgumentPosition: fixedPosition,
              selected,
            }),
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
