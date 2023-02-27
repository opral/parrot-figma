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
    useSampleValues: boolean;

    x: number,
    y: number,
    width: number,
    height: number,

    key: string;
    text: string;

    pluralId: Plural;

}