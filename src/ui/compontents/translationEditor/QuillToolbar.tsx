/* eslint-disable jsx-a11y/control-has-associated-label */
import * as React from 'react';

import Quill, {
  QuillOptionsStatic,
  DeltaStatic,
  RangeStatic,
  BoundsStatic,
  StringMap,
  Sources,
  Delta as DeltaType,
} from 'quill';

type QuillToolbarProps = {
  quill: Quill,
};

export default function QuillToolbar({
  quill,
}: QuillToolbarProps) {
  const currentPlaceholder = {
    name: 'first_name',
    type: 'string',
    fillin: 'Maddin',
  } as {
    name: string,
    type: string,
    fillin: string,
  } | undefined;

  const bold = false;
  const underline = false;
  const strikethrough = false;
  const italic = false;

  const currentLink = 'google.com' as string | undefined;

  const createPlaceholder = false;
  const editPlaceholderName = false;
  const createLink = false;
  const editLink = false;

  const showFormatting = !editPlaceholderName && !createPlaceholder && !createLink && !editLink;
  const hidePlaceholder = false;

  // TODO listen to quill range change event
  // TODO extract quill formats and change properties
  // TODO wrap with outside click for cancel
  // TODO react on esc and hide controll
  // TODO react on enter to save current Value
  // TODO update state of the buttons based on format
  // TODO apply format on button click
  // TODO position tooltip based on selection

  return (
    <>
      <span className="ql-tooltip-arrow" />
      <div className="ql-toolbar">
        { showFormatting && (
        <span className="ql-formats">
          <button type="button" className="ql-bold">
            <svg viewBox="0 0 18 18">
              <path className="ql-stroke" d="M5,4H9.5A2.5,2.5,0,0,1,12,6.5v0A2.5,2.5,0,0,1,9.5,9H5A0,0,0,0,1,5,9V4A0,0,0,0,1,5,4Z" />
              <path className="ql-stroke" d="M5,9h5.5A2.5,2.5,0,0,1,13,11.5v0A2.5,2.5,0,0,1,10.5,14H5a0,0,0,0,1,0,0V9A0,0,0,0,1,5,9Z" />
            </svg>
          </button>
          <button type="button" className="ql-italic">
            <svg viewBox="0 0 18 18">
              <line className="ql-stroke" x1="7" x2="13" y1="4" y2="4" />
              <line className="ql-stroke" x1="5" x2="11" y1="14" y2="14" />
              <line className="ql-stroke" x1="8" x2="10" y1="14" y2="4" />
            </svg>
          </button>
          <button type="button" className="ql-link">
            <svg viewBox="0 0 18 18">
              <line className="ql-stroke" x1="7" x2="11" y1="7" y2="11" />
              <path className="ql-even ql-stroke" d="M8.9,4.577a3.476,3.476,0,0,1,.36,4.679A3.476,3.476,0,0,1,4.577,8.9C3.185,7.5,2.035,6.4,4.217,4.217S7.5,3.185,8.9,4.577Z" />
              <path className="ql-even ql-stroke" d="M13.423,9.1a3.476,3.476,0,0,0-4.679-.36,3.476,3.476,0,0,0,.36,4.679c1.392,1.392,2.5,2.542,4.679.36S14.815,10.5,13.423,9.1Z" />
            </svg>
          </button>
          { currentPlaceholder !== undefined && !hidePlaceholder
            && <button type="button" className="ql-placeholder" />}
          { currentPlaceholder && (
          <input type="text" value={currentPlaceholder?.fillin} />
          )}
        </span>
        )}
      </div>
      <div className="ql-placholder-editor">
        { createPlaceholder && (
          <input type="text" />
        )}
        { editPlaceholderName && (
          <input type="text" value={currentPlaceholder?.name} />
        )}
      </div>
      <div className="ql-link-editor">
        { createLink && (
          <input type="text" />
        )}
        { editLink && (
          <input type="text" value={currentLink} />
        )}
      </div>
      <div className="ql-tooltip-editor">
        <input type="text" data-formula="e=mc^2" data-link="https://quilljs.com" data-video="Embed URL" />
      </div>
    </>
  );
}
