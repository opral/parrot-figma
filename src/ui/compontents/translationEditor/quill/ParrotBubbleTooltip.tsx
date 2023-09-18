import Emitter from 'quill/core/emitter';
import Tooltip from 'quill/ui/tooltip';
import { Range } from 'quill/core/selection';
import Quill, { Delta as DeltaType } from 'quill';


const icons = Quill.import('ui/icons');

const Delta = Quill.import('delta') as typeof DeltaType;

export default class ParrotBubbleTooltip extends Tooltip {
  static TEMPLATE = [
    '<span class="ql-tooltip-arrow"></span>',
    '<div class="ql-tooltip-editor">',
    '<input type="text" data-formula="e=mc^2" data-link="https://quilljs.com" data-video="Embed URL">',
    '<a class="ql-close"></a>',
    '</div>',
  ].join('');

  constructor(quill: Quill, bounds: HTMLElement) {
    super(quill as any, bounds);
    this.quill.on(
      Emitter.events.EDITOR_CHANGE,
      (type, range, oldRange, source) => {
        if (type !== Emitter.events.SELECTION_CHANGE) return;
        if (
          range != null
              && range.length > 0
              && source === Emitter.sources.USER
        ) {
          this.show();
          // Lock our width so we will expand beyond our offsetParent boundaries
          this.root.style.left = '0px';
          //this.root.style.width = '';
          //this.root.style.width = `${this.root.offsetWidth}px`;
          const lines = this.quill.getLines(range.index, range.length);
          if (lines.length === 1) {
            this.position(this.quill.getBounds(range));
          } else {
            const lastLine = lines[lines.length - 1];
            const index = this.quill.getIndex(lastLine);
            const length = Math.min(
              lastLine.length() - 1,
              range.index + range.length - index,
            );
            const indexBounds = this.quill.getBounds(new Range(index, length));
            this.position(indexBounds);
          }
        } else if (
          document.activeElement !== this.textbox
              && this.quill.hasFocus()
        ) {
          this.hide();
        }
      },
    );
    this.textbox = this.root.querySelector('input[type="text"]');
    this.listen();
  }

  listen() {
    this.textbox!.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.save();
        event.preventDefault();
      } else if (event.key === 'Escape') {
        this.cancel();
        event.preventDefault();
      }
    });

    // @ts-expect-error Fix me later
    this.root.querySelector('.ql-close').addEventListener('click', () => {
      this.root.classList.remove('ql-editing');
    });
    this.quill.on(Emitter.events.SCROLL_OPTIMIZE, () => {
      // Let selection be restored by toolbar handlers before repositioning
      setTimeout(() => {
        if (this.root.classList.contains('ql-hidden')) return;
        const range = this.quill.getSelection();
        if (range != null) {
          this.position(this.quill.getBounds(range));
        }
      }, 1);
    });
  }

  textbox: HTMLInputElement | null;

  linkRange?: Range;

  edit(mode = 'link', preview = null) {
    this.root.classList.remove('ql-hidden');
    this.root.classList.add('ql-editing');
    if (preview != null) {
      // @ts-expect-error Fix me later
      this.textbox.value = preview;
    } else if (mode !== this.root.getAttribute('data-mode')) {
      // @ts-expect-error Fix me later
      this.textbox.value = '';
    }
    this.position(this.quill.getBounds(this.quill.selection.savedRange));
    // @ts-expect-error Fix me later
    this.textbox.select();
    // @ts-expect-error Fix me later
    this.textbox.setAttribute(
      'placeholder',
      // @ts-expect-error Fix me later
      this.textbox.getAttribute(`data-${mode}`) || '',
    );
    this.root.setAttribute('data-mode', mode);
  }

  restoreFocus() {
    const { scrollTop } = (this.quill as any).scroll.domNode.scrollTop;
    this.quill.focus();
    (this.quill as any).scroll.domNode.scrollTop = scrollTop;
  }

  save() {
    // @ts-expect-error Fix me later
    const { value } = this.textbox;
    switch (this.root.getAttribute('data-mode')) {
      case 'placeholder': {
        this.restoreFocus();
        const range = this.quill.getSelection();
        const selectedText = range ? this.quill.getText(range) : undefined;
        if (range) {
          const contents = this.quill.getContents();
          const beforeSelectionContents = contents.slice(0, range.index);
          const selectionContents = contents.slice(range.index, range.index + range.length);
          const afterSelectionContents = contents.slice(range.index + range.length, contents.length());

          // TODO weight the formats - for now use the first
          const replacementDelta = (new Delta()).insert(value, {
            placeholder: { type: 'string', name: value, fillin: selectedText },
            ...selectionContents.ops[0].attributes,
          });

          const updatedDelta = beforeSelectionContents.concat(replacementDelta as any).concat(afterSelectionContents);

          this.quill.setContents(updatedDelta, Emitter.sources.USER);
        }
        // this.quill.setText('', Emitter.sources.USER);
        break;
      }
      case 'link': {
        const { scrollTop } = this.quill.root;
        if (this.linkRange) {
          this.quill.formatText(
            this.linkRange,
            'link',
            value,
            Emitter.sources.USER,
          );
          delete this.linkRange;
        } else {
          this.restoreFocus();
          this.quill.format('link', value, Emitter.sources.USER);
        }
        this.quill.root.scrollTop = scrollTop;
        break;
      }

      default:
    }
    // @ts-expect-error Fix me later
    this.textbox.value = '';
    this.hide();
  }

  cancel() {
    this.show();
  }

  position(reference: any) {
    const shift = super.position(reference);
    const arrow = this.root.querySelector('.ql-tooltip-arrow');
    // @ts-expect-error
    arrow.style.marginLeft = '';
    if (shift !== 0) {
      // @ts-expect-error
      arrow.style.marginLeft = `${-1 * shift - arrow.offsetWidth / 2}px`;
    }
    return shift;
  }
}
