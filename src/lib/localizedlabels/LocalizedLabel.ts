import Language from '../base/Language';
import Plural from '../base/Plural';

export enum KeyState {
  Unset = 'unset', // label has not yet modified by the plugin
  Unlinked = 'unlinked', // state when the label has not been translated by the plugin yet
  Linked = 'linked', // key was set to a fixed key
}

export interface LocalizedLabel {

  pageId: string;
  pageName: string;

  rootFrameId: string;
  rootFrameName: string;

  nodeId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;

  rootFrameLanguage: Language;

  language: Language;
  rootFrameUseSampleValues: boolean;

  useSampleValues: boolean;
  keyType: KeyState
  key?: string;
  keyVersion: number,
  pluralId: Plural;
  text?: string;

  textChangedAfterGeneration: boolean;

  derivedKey?: string;

}
