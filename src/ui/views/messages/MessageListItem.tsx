/* eslint-disable jsx-a11y/mouse-events-have-key-events */
/* eslint-disable jsx-a11y/interactive-supports-focus */
/* eslint-disable prefer-template */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/label-has-associated-control */
import * as React from 'react';
import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';

import '../../localization/i18n';
import { Locale } from '../../../lib/message/variants/Locale';

import MessageStoreMemory from '../../../lib/message/store/MessageStoreMemory';

import FigmaUtil from '../../../shared/FigmaUtil';

import TranslationEditor from '../../compontents/translationEditor/TranslationEditor';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';

import FEATURES_FLAGS from '../../featuretoggle';
import Drawer from '../../compontents/drawer/Drawer';
import TextField from '../../compontents/textfield/TextField';
import { MessageParameterValues } from '../../../lib/message/MessageParameterValues';
// import ReactQuill from 'react-quill';

type TranslationKeyListItemProps = {
  rowClassNames?: string | undefined,
  figmaRemote: FigmaUtil,
  searchMatch: any,
  messageStore: MessageStoreMemory,
  messageId: string,
  localizedLabelManager: LocalizedLabelManagerUI,
  select?: Function,
  messageSelected: boolean,
  onFocus?: (messageId: string, locale?: Locale, variantMatch?: string[]) => void,
  onBlur?: (messageId: string, locale?: Locale, variantMatch?: string[]) => void,
};

// TODO #27 select message on click - message / message variant
// TODO #27 highlight first screen that matches the given combination
// TODO #27 disable message rename
// TODO #27 add search again (no filtering in v1)
// TODO #27 fix layers layout
// TODO #27 creating a new key shows key twice in key tab - this is the optimazion key used in table previously

export default function TranslationKeyListItem({
  rowClassNames,
  figmaRemote,
  searchMatch,
  messageStore,
  messageId,
  localizedLabelManager,
  select,
  messageSelected,
  onFocus,
  onBlur,
}: TranslationKeyListItemProps) {
  const [messageNameHovered, setMessageNameHoverd] = useState(false);

  const [focusedMessageVariant, setFocusedMessageVariant] = useState<undefined | { messageId: string, locale?: Locale, match?: string[] }>(undefined);

  // const [history, setHistory] = useState<undefined | VersionEntry[]>(undefined);
  const [messageIdToDelete, setMessageIdToDelete] = useState<undefined | string>(undefined);
  const [keyToDeleteReferences, setKeyToDeleteReferences] = useState<undefined | number>(undefined);

  const [message, setMessage] = useState(localizedLabelManager.messageStore.getMessage(messageId)!);

  const rowRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageStore.inlangProject?.query.messages.get.subscribe({ where: { id: messageId } }, (updatedMessage) => {
      setMessage(updatedMessage);
    });
  }, []);

  useEffect(() => {
    const updateReferenceCount = async () => {
      const referenceCount = (await localizedLabelManager.getWithMessage(messageIdToDelete!)).length;
      setKeyToDeleteReferences(referenceCount);
    };

    if (messageIdToDelete) {
      updateReferenceCount();
    }
  }, [messageIdToDelete]);

  const refLanguage = messageStore.getRefLanugage();

  // create an array of languages with baselanguage at position zero
  const languages = [refLanguage, ...messageStore.getLanugages()!.filter((l) => l !== refLanguage)] as Locale[];

  return (
    <div
      ref={rowRef}
      className={`message-group ${messageSelected ? 'message-group-selected' : ''} ${rowClassNames !== undefined ? rowClassNames : ''} ${messageNameHovered ? ' message-group-hovered' : ''} ${focusedMessageVariant !== undefined ? ' message-group-focused' : ''}`}
      onClick={() => {
        if (select) {
          select(message.id);
        }
      }}
    > 
        <div
          className={'message-group-header ' + (messageSelected ? ' selected' : '')}
          onMouseOver={() => { setMessageNameHoverd(true); }}
          onMouseOut={() => { setMessageNameHoverd(false); }}
        >
          <div className="spacer" />
          <div className="message-group-header-element-symbol">
            <div className="svg-container with-message-svg" />
          </div>
          <div className="message-group-header-name">
            <div className="rowText">
              <TextField
                singleClick={false}
                onSave={async (messageName: string) => {
                // TODO #17 versioning - support message renaming. We will allow to rename not before we have the history that can keep track of name changes
                // localizedLabelManager.updateMessage(message.id, {
                //   variants: [],
                //   name: messageName,
                // });
                }}
                text={messageId}
              />
            </div>
          </div>
          <div className="message-group-header-actions">
            { select === undefined && (
            <>
              {/* <div
              className="layerIcon iconWrapper button"
              data-tooltip-content="Delete this translation key"
              onClick={() => {
                // copy
              }}
            >
              <span className="svg-container copy-svg" />
            </div> */}
              <div
                className="layerIcon iconWrapper button"
                data-tooltip-content="Delete this translation key"
                onClick={() => {
                  setMessageIdToDelete(message.id);
                }}
              >
                <span className="svg-container trash-svg" />
              </div>

            </>
            )}
          </div>
        </div>
        <div className="message-group-header-sticky-border">test</div>
      
      {languages.map((language, i, allLanguages) => {
        const variant = message.variants.find((currentVariant) => currentVariant.languageTag === language);
        let variantHTML = '';
        if (variant !== undefined) {
          variantHTML = MessageStoreMemory.patternToHtml(variant.pattern);
        }

        return (
          <div className={`message-group-variant-wrapper ${language === refLanguage ? ' ref-language' : ''} ${focusedMessageVariant !== undefined && focusedMessageVariant.locale === language ? ' message-group-variant-focused' : ''}`} key={language}>
            <div className="message-group-variant">
              <div className="spacer" />
              <div className="spacer" />
              <div className="message-group-variant-column-language">
                <span className="language">{language}</span>
                { language === localizedLabelManager.messageStore.getRefLanugage() && (
                  <span className="language-tag">ref</span>
                )}
              </div>
              <div className="message-group-variant-column-translation">
                <TranslationEditor
                  parameterValues={{} /*  TODO #18 default values  support fillins message.defaultFillins */}
                  editable={select === undefined}
                  isDisabled={false}
                  match={searchMatch?.textMatches[language]?.['*']}
                  onSave={async (text: string | undefined, parameters: MessageParameterValues) => {
                  // let skip = message.variants[language as Locale]?.[gender as Gender]?.[plural as Plural]?.skip ?? false;

                    Object.values(parameters).forEach((parameter) => {
                    // eslint-disable-next-line no-param-reassign
                      parameter.default = true;
                    });

                    // TODO #18 variables how to deal with default values acutally - as soon as we have variants this can become tricky since the matcher does differ from the default value :( )
                    // - one thought on this - variables used in selectors can not have a default value...
                    const updatedMessage = MessageStoreMemory.upsertVariantPatternHtml(message, undefined, language, [], text ?? '');
                    await localizedLabelManager.updateMessage(updatedMessage, parameters);
                  }}
                  onFocus={() => {
                    setFocusedMessageVariant({
                      messageId: message.id,
                      locale: language,
                      match: [],
                    });
                    onFocus?.(message.id, language, []);
                  }}
                  onBlur={() => {
                    setFocusedMessageVariant(undefined);
                    onBlur?.(message.id, language, []);
                  }}
                  variantHTML={variantHTML}
                  messageStore={messageStore}
                />
              </div>
              { false && ( // TODO #27 make this depending on the warning
                <div
                  className="layerIcon iconWrapper button"
                  data-tooltip-content="Show warnings..."
                  onClick={() => {
                    // show warning/error menu
                  }}
                >
                  <span className="svg-container notice-svg" />
                </div>
              )}
              { false && ( // TODO #27 make this depending on the warning
                <div
                  className="layerIcon iconWrapper button"
                  data-tooltip-content="More..."
                  onClick={() => {
                    // show action menu
                  }}
                >
                  <span className="svg-container three-dots-svg" />
                </div>
              )}
            </div>
          </div>
        );
      })}
      <Drawer
        position="top"
        buttons={[
          {
            type: 'secondary',
            text: 'Cancel',
            key: 'escape',
            callback: () => {
              // set back to head
              setMessageIdToDelete(undefined);
            },
          },
          {
            type: 'primary-destructive',
            text: 'Delete Key',
            key: 'enter',
            disabled: messageIdToDelete === undefined,
            callback: () => {
              localizedLabelManager.deleteMessage(message.id).catch((e: Error) => {
                Sentry.captureException(e);
                figmaRemote.notifyError(e.message);
              });
              setMessageIdToDelete(undefined);
            },
          },

        ]}
        shown={messageIdToDelete !== undefined}
      >
        <div className="history_view--topHeader">
          Delete
          {' '}
          {localizedLabelManager.messageStore.getMessage(messageIdToDelete!)?.id}
        </div>
        <div>
          {keyToDeleteReferences !== undefined && keyToDeleteReferences > 0 && (
            <>
              Deletion of the Message
              {' '}
              {localizedLabelManager.messageStore.getMessage(messageIdToDelete!)?.id}
              {' '}
              will unlink
              {' '}
              {keyToDeleteReferences}
              {' '}
              referencing labels.

            </>
          )}
          {keyToDeleteReferences === 0 && (
          <>
            Key
            {' '}
            {localizedLabelManager.messageStore.getMessage(messageIdToDelete!)?.id}
            {' '}
            is not refrenced by a label
          </>
          )}
        </div>
      </Drawer>
    </div>
  );
}
