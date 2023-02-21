import { Language } from "./Language";
import { Plural } from "./Plural";


export interface LocalizedLabel {
    pageId: string;
    pageName: string;

    rootFrameId: string;
    rootFrameName: string;
    rootFrameLanguage: Language;
    rootFrameUseSampleValues: boolean;
    
    name: string;
    nodeId: string;
    
    x: number,
    y: number,
    width: number,
    height: number, 
    
    keyExists: boolean;

    key: string;
    text: string;
    
    figmaTextFilled?: string;
    
    useSampleValues: boolean;
    pluralId: Plural;
    // contains all plural forms 
    plurals: Plural[];
    translataions?: { 
        [pluralId: string]: {
            translation?: string,
            translationFilled?: string
        } 
    };
    
    selected: boolean;
}