/* eslint-disable max-classes-per-file */

import BaseTheme from 'quill/themes/base';

import Quill, { Delta as DeltaType } from 'quill';
import { after } from 'lodash';
import ParrotBubbleTooltip from './ParrotBubbleTooltip';

const icons = Quill.import('ui/icons');
const Delta = Quill.import('delta') as typeof DeltaType;

const TOOLBAR_CONFIG = [
  ['bold', 'italic', 'link'],
  [{ header: 1 }, { header: 2 }, 'blockquote'],
];

export default class ParrotTheme extends BaseTheme {
  constructor(quill: Quill, options: any) {
    if (
      options.modules.toolbar != null
        && options.modules.toolbar.container == null
    ) {
      // eslint-disable-next-line no-param-reassign
      options.modules.toolbar.container = TOOLBAR_CONFIG;
    }
    super(quill as any, options);
    this.quill.container.classList.add('ql-bubble');
  }

  extendToolbar(toolbar: any) {
    // @ts-expect-error
    this.tooltip = new ParrotBubbleTooltip(this.quill, this.options.bounds);
    this.tooltip!.root.appendChild(toolbar.container);
    this.buildButtons(toolbar.container.querySelectorAll('button'), icons);
    this.buildPickers(toolbar.container.querySelectorAll('select'), icons);
  }
}

ParrotTheme.DEFAULTS = {
  modules: {
    toolbar: {
      handlers: {
        /* link(value: any) {
            //console.log(this.quill.getFormat(this.quill.getSelection()!));
          if (false && !value) {
            this.quill.format('link', false);
          } else {
            this.quill.theme.tooltip.edit('link');
          }
        },
        placeholder(value: any) {
            this.quill.theme.tooltip.edit('placeholder');
        } */
      },
    },
  },
};

// Quill.register({'modules/toolbar': Toolbar})
