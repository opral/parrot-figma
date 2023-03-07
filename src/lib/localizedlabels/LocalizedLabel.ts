import { Language } from "../base/Language";
import { Plural } from "../base/Plural";

export enum KeyState {
    Unset = 'unset', // state when the label has not been translated by the plugin yet
    Ephemeral = 'ephemeral', // a key was generated for a node that didn't fullfill the requirement to be derived 
    Derived = 'derived', // a key was derived by the document derivation method
    Linked = 'linked',   // key was set to a fixed key 
  }
  

export interface LocalizedLabel {
    
    pageId: string;
    pageName: string;

    rootFrameId: string;
    rootFrameName: string;
    rootFrameLanguage: Language;
    rootFrameUseSampleValues: boolean;

    name: string;
    nodeId: string;
    useSampleValues: boolean;

    x: number;
    y: number;
    width: number;
    height: number;

    keyType: KeyState
    key?: string;
    derivedKey?: string;
    text: string;

    keyVersion: number,


    pluralId: Plural;

}