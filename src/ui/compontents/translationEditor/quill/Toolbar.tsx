import Quill, { Delta as DeltaType } from 'quill';

import Toolbar from 'quill/modules/toolbar';
import Emitter from 'quill/core/emitter';
import { PlaceholderProps } from 'react-select';
import { Placeholder } from '../../../../lib/message/MessageExtnesions';

const Delta = Quill.import('delta') as typeof DeltaType;

export default class ParrotToolbar extends Toolbar {
  tooltipEditor: HTMLInputElement;

  tooltipEditorInput: HTMLInputElement;

  placholderFillinInput: HTMLInputElement;

  placholderEditButton: HTMLButtonElement;

  linkEditButton: HTMLButtonElement;

  currentRange: any;

  getParameters: undefined | ((name: string) => any);

  setParameter: undefined | ((name: string, value: any) => void);

  constructor(quill: Quill, options: any) {
    super(quill as any, options);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = [
      '<span class="ql-tooltip-arrow"></span>',
      '<div class="ql-placeholder-group">',
      '<button class="ql-button ql-link">link</button> <button class="ql-button ql-placeholder">(xy)</button> <input type="text" class="ql-placeholder-fillin"/>',
      '</div>',
      '<div class="ql-tooltip-editor ql-hidden">',
      '<input type="text">',
      '<a class="ql-close"></a>',
      '</div>',
    ].join('');
    this.linkEditButton = wrapper.querySelector('.ql-button.ql-link') as HTMLButtonElement;
    this.linkEditButton.addEventListener('click', this.onLinkClick.bind(this));

    this.placholderEditButton = wrapper.querySelector('.ql-button.ql-placeholder') as HTMLButtonElement;
    this.placholderEditButton.addEventListener('click', this.onPlaceholderClick.bind(this));

    this.placholderFillinInput = wrapper.querySelector('.ql-placeholder-fillin') as HTMLInputElement;
    this.placholderFillinInput.addEventListener('keydown', this.onFillinValueChanged.bind(this));
    this.tooltipEditor = wrapper.querySelector('.ql-tooltip-editor') as HTMLInputElement;
    this.tooltipEditorInput = wrapper.querySelector('.ql-tooltip-editor input') as HTMLInputElement;
    this.tooltipEditorInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.save();
        event.preventDefault();
      } else if (event.key === 'Escape') {
        this.cancel();
        event.preventDefault();
      }
    });

    this.container!.appendChild(wrapper);
  }

  setParameterHandler(getParameters: (name: string) => any, setParameter: (name: string, value: any) => void) {
    this.getParameters = getParameters;
    this.setParameter = setParameter;
  }

  restoreFocus() {
    const { scrollTop } = (this.quill as any).scroll.domNode.scrollTop;
    this.quill.focus();
    (this.quill as any).scroll.domNode.scrollTop = scrollTop;
  }

  save() {
    const { value } = this.tooltipEditorInput;
    if (this.editMode === 'link' && value !== 'MIXED') {
      const { scrollTop } = this.quill.root;

      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;
      const urlRegex = /^(https?|HTTPS?):\/\/[^\s/$.?#].[^\s]*$/;
      let valueToSet = false as boolean | string;

      if (value === '') {
        valueToSet = false;
      } else if (value.startsWith('mailto:')) {
        // check if we have a valid mail abc@abc1.com ...
        if (emailRegex.test(value.substring('mailto:'.length))) {
          valueToSet = value;
        } else {
          // invalid mail adress
        }
      } else if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
        const urlToCheck = value.startsWith('/') ? `https://helperdomain${value}` : value;
        if (urlRegex.test(urlToCheck)) {
          valueToSet = value;
        } else {
          // invalid url
        }
      } else if (emailRegex.test(value)) {
        // value matches an email adress
        valueToSet = `mailto:${value}`;
      } else if (urlRegex.test(`https://${value}`)) {
        // matches a url pattern
        valueToSet = `https://${value}`;
      } else {
        // invalid url :-/
      }

      if (valueToSet === false) {
        // TODO inform the user
      }

      this.quill.formatText(
        this.currentRange,
        'link',
        valueToSet,
        'user', // Emitter.sources.USER,
      );
      this.restoreFocus();

      this.quill.root.scrollTop = scrollTop;
    } else if (this.editMode === 'placeholder') {
      this.restoreFocus();
      const range = this.quill.getSelection();

      // TODO check for defaults in case we have an empty value...
      const parameterValue = this.selectedPlacholder.length === 0 ? this.quill.getText(range!) : this.selectedPlacholder[0].fillin;
      if (range) {
        const contents = this.quill.getContents();
        const beforeSelectionContents = contents.slice(0, range.index);
        const selectionContents = contents.slice(range.index, range.index + range.length);
        const afterSelectionContents = contents.slice(range.index + range.length, contents.length());

        let replacementDelta: DeltaType;
        if (value === '') {
          delete selectionContents.ops[0].attributes?.placeholder;
          // remove placeholder and use fillin
          const updatedAttributes = {
            ...selectionContents.ops[0].attributes,
          };
          updatedAttributes.placeholder = null;
          replacementDelta = (new Delta()).insert(parameterValue, updatedAttributes);
        } else {
          const updatedAttributes = {
            ...selectionContents.ops[0].attributes,
          };
          updatedAttributes.placeholder = { name: value, named: true } as Placeholder;
          this.setParameter?.(value, parameterValue);

          // TODO #14 variables - we want to somehow update the parameters based on the input
          replacementDelta = (new Delta()).insert(value, updatedAttributes);
        }
        // TODO weight the formats - for now use the first

        const updatedDelta = beforeSelectionContents.concat(replacementDelta as any).concat(afterSelectionContents);

        this.quill.setContents(updatedDelta, 'user' /* Emitter.sources.USER */);
      }
    }

    this.editMode = undefined;
    this.tooltipEditor.classList.remove('ql-editing');
    (this.quill.theme as any).tooltip.hide();
  }

  cancel() {
    this.editMode = undefined;
    this.tooltipEditor.classList.remove('ql-editing');
    (this.quill.theme as any).tooltip.show();
  }

  editMode = undefined as 'link' | 'placeholder' | undefined;

  onFillinValueChanged(event: any) {
    if (event.key === 'Enter') {
      const range = this.currentRange;
      const parameterName = this.selectedPlacholder[0].name;
      // TODO check for defaults in case we have an empty value...
      const parameterValue = this.placholderFillinInput.value;
      if (range) {
        const contents = this.quill.getContents();
        const beforeSelectionContents = contents.slice(0, range.index);
        const selectionContents = contents.slice(range.index, range.index + range.length);
        const afterSelectionContents = contents.slice(range.index + range.length, contents.length());

        selectionContents.ops[0].attributes!.placeholder = { name: parameterName, named: true } as Placeholder;
        this.setParameter?.(parameterName, parameterValue);
        // TODO weight the formats - for now use the first
        const replacementDelta = (new Delta()).insert(parameterName, {
          ...selectionContents.ops[0].attributes,
        });

        const updatedDelta = beforeSelectionContents.concat(replacementDelta as any).concat(afterSelectionContents);

        this.quill.setContents(updatedDelta, 'user' /* Emitter.sources.USER */);
      }

      event.preventDefault();
    } else if (event.key === 'Escape') {
      // TODO #14 variables - we need to store the parameter value before we udpated to be able to undo it for now
      this.placholderFillinInput.value = this.placholderFillinInput.getAttribute('data-orginal-value')!;
      event.preventDefault();
    }
  }

  onPlaceholderClick() {
    // check if the current
    this.tooltipEditor.classList.add('ql-editing');
    this.tooltipEditor.classList.remove('ql-hidden');
    this.editMode = 'placeholder';

    this.tooltipEditorInput.placeholder = 'Enter Placeholder Name';
    if (this.selectedPlacholder.length === 0) {
      this.tooltipEditorInput.value = '';
      this.tooltipEditorInput.setAttribute('data-orginal-value', '');
    } else if (this.selectedPlacholder.length === 1) {
      this.tooltipEditorInput.value = this.selectedPlacholder[0].name;
      this.tooltipEditorInput.setAttribute('data-orginal-value', this.selectedPlacholder[0].name);
    }
    this.tooltipEditorInput.focus();
  }

  onLinkClick() {
    this.tooltipEditor.classList.add('ql-editing');
    this.tooltipEditor.classList.remove('ql-hidden');

    this.editMode = 'link';

    const selectionStart = this.quill.getSelection()!.index;
    const selectionEnd = this.quill.getSelection()!.index + this.quill.getSelection()!.length;

    let start = 0;
    let end = 0;

    let linkStart = -1;
    let linkEnd = -1;
    let currentLink = undefined as string | undefined;

    this.tooltipEditorInput.placeholder = 'Enter Link address';

    const rangeFormat = this.quill.getFormat(this.currentRange!);

    const oneLink = typeof this.quill.getFormat(this.currentRange!).link === 'string';

    if (oneLink) {
      for (const op of this.quill.getContents().ops) {
        if (typeof op.insert === 'string') {
          // eslint-disable-next-line no-continue
          end = start + op.insert.length;
        }

        // link ends
        if ((currentLink && op.attributes?.link !== currentLink)
                || end === this.quill.getContents().length()) {
          // sad
          if (selectionStart >= linkStart && selectionEnd <= linkEnd) {
            break;
          } else {
            currentLink = undefined;
          }
        }

        if (op.attributes?.link) {
          if (currentLink === undefined) {
            currentLink = op.attributes?.link as string;
            linkStart = start;
          }
          linkEnd = end;
        }
        start = end;
      }

      if (currentLink) {
        this.tooltipEditorInput.value = currentLink;

        this.tooltipEditorInput.setAttribute('data-orginal-value', currentLink);
        this.currentRange = { index: linkStart, length: linkEnd };
      }
      this.tooltipEditorInput.value = currentLink ?? '';
    } else if (this.linkUrls.length > 0) {
      this.tooltipEditorInput.value = 'MIXED';

      this.tooltipEditorInput.setAttribute('data-orginal-value', 'MIXED');
    } else {
      this.tooltipEditorInput.value = '';
    }
    this.tooltipEditorInput.focus();
  }

  linkUrls = [] as string[];

  linkUrl = undefined as string | undefined;

  selectedPlacholder = [] as { name: string, type: string, fillin: string }[];

  update(range: any) {
    const formats = range == null ? {} as any : this.quill.getFormat(range);
    this.linkUrls = [];

    if (range) {
      this.selectedPlacholder = [];
      this.tooltipEditor.classList.remove('ql-editing');
      this.currentRange = range;
      const selectedDelta = this.quill.getContents(range);

      let selectionChunkWithNoPlaceholder = false;
      for (const deltaOp of selectedDelta.ops) {
        if (deltaOp.attributes?.placeholder) {
          const placeholder = deltaOp.attributes.placeholder as any;
          this.selectedPlacholder.push({
            name: placeholder.name!,
            type: placeholder.type!,
            fillin: placeholder.fillin,

          });
        } else {
          selectionChunkWithNoPlaceholder = true;
        }

        if (deltaOp.attributes?.link && !this.linkUrls.includes(deltaOp.attributes.link as string)) {
          this.linkUrls.push(deltaOp.attributes?.link as string);
        }
      }

      this.linkEditButton.classList.toggle('ql-active', this.linkUrls?.length > 0);

      if (this.selectedPlacholder.length > 1
        || (selectionChunkWithNoPlaceholder && this.selectedPlacholder.length > 0)) {
        // TODO hide placeholder nodes
        this.placholderFillinInput.classList.toggle('ql-hidden', true);
        this.placholderEditButton.classList.toggle('ql-hidden', true);
      } else if (!selectionChunkWithNoPlaceholder && this.selectedPlacholder.length === 1) {
        // show edit placeholder
        this.placholderFillinInput.classList.toggle('ql-hidden', false);
        // TODO #14 variables replace this with the parameters from parameter of the current label
        // what if we do not edit a label but a message? Default values should only be used for non selectors...
        const paramValue = this.getParameters?.(this.selectedPlacholder[0].name) ?? 'getter not set!';
        this.placholderFillinInput.value = paramValue;
        this.placholderFillinInput.setAttribute('data-orginal-value', paramValue);
        this.placholderEditButton.classList.toggle('ql-hidden', false);
        this.placholderEditButton.classList.toggle('ql-active', true);
      } else if (this.selectedPlacholder.length === 0) {
        // TODO show create placeholder nodes
        this.placholderFillinInput.classList.toggle('ql-hidden', true);
        this.placholderEditButton.classList.toggle('ql-hidden', false);
        this.placholderEditButton.classList.toggle('ql-active', false);
      }
    }

    this.controls.forEach((pair: any) => {
      const [format, input] = pair;
      if (range == null) {
        input.classList.remove('ql-active');
      } else if (input.hasAttribute('value')) {
        // both being null should match (default values)
        // '1' should match with 1 (headers)
        const isActive = formats[format] === input.getAttribute('value')
          || (formats[format] != null
            && (formats[format] as any).toString() === input.getAttribute('value'))
          || (formats[format] == null && !input.getAttribute('value'));
        input.classList.toggle('ql-active', isActive);
      } else {
        input.classList.toggle('ql-active', formats[format] != null);
      }
    });
  }
}
// Toolbar.DEFAULTS = {};
