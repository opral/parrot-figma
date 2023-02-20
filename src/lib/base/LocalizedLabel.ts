

export interface LocalizedLabel {
    pageId: string;
    pageName: string;

    rootFrameId: string;
    rootFrameName: string;
    rootFrameLanguage: string;
    
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
    pluralId: string;
    // contains all plural forms 
    plurals: string[];
    translataions?: { 
        [pluralId: string]: {
            translation?: string,
            translationFilled?: string
        } 
    };
    
    selected: boolean;
}