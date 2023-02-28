import { Language } from "../base/Language";
import { Plural } from "../base/Plural";



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

    keyType: 'unset' | // state when the label has not been translated by the plugin yet
             'ephemeral' | // a key was generated for a node that didn't fullfill the requirement to be derived 
             'derived' | // a key was derived by the document derivation method
             'linked';   // key was set to a fixed key 

    key?: string;
    derivedKey?: string;
    text: string;

    pluralId: Plural;

}