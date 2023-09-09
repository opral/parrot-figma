/* eslint-disable max-classes-per-file */

import BaseTheme from 'quill/themes/base';

import Quill from 'quill';

import ParrotBubbleTooltip from './ParrotBubbleTooltip';

const icons = Quill.import('ui/icons');

export default class ParrotTheme extends BaseTheme {
  constructor(quill: Quill, options: any) {
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
