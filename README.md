
# Project assets and resources for figma

MVP 
 - define sharedPluginDataFormat
 - store key / values in one blob in the plugin data
 - implement api to access new format
 - implement figma localization state
 - implement key edit view to allow to create new keys / delete / tag
 - implement script to export strings.dict for ios
 - implement script to export ressources for android
 - make frame feel more native
    - fullscreen
    - modal
    - bottomsheet


# Export format 

Keys can be accessed and transformed using sharedPluginData added to figmas root node of a file. 

Information available:

key_name: string
tags: string[]
plurals: ['other', 'zero', ...],
translations: {
    'de': {
        'other': string, // default string always the fallback
        'zero': string, 
        'one': string,
        'two': string,
        'few': string, // not supported for now
        'many': string, // not supported for now
    }
}

# thoughs
User pays per file - one file for free
User pays per colaborator - one 

# investiage:
how does pricing workg 
https://www.figma.com/community/plugin/1169407128424809563


undo forward:
https://forum.figma.com/t/pass-shortcuts-to-figma-when-focused-on-the-plugin-window-and-vice-versa/10229


react optimization
https://tolgee.io/blog/2021/11/24/optimizing-react-to-the-bone

https://lokalise.com/blog/design-stage-localization/


Todos: 

 - [x] specify languages for file
 - [x] specfify base language 
 - [x] show baselanguage in lokalised key always on top 
 - [x] make header columns fixed size based on maximum column content
 - [ ] allow the user to resolve the apply conflicts 
 - [ ] handle automatic design update based on version
 - [ ] allow user to select a key for a label
 - [ ] allow to add a key manually 
 - [ ] plural select
 - [ ] key propagation from sandbox (multi user test)

 - [ ] variable replacement logic
 - [ ] distinct visual style for base language like bold
 - [ ] translation editor ux - we should be able to hide skipped values from option in toolbar

 - [ ] allow to rename keys
 
 - [ ] history (who changed what when?) 
 - [ ] qa handling of translation
 - [ ] fix window manager bugs
 - [ ] filter - match case, need review etc based on figmas search design
 
 - [ ] import of ios dict
 - [ ] import of android dict
 
 - [ ] add export tab with versioning
 - [ ] export tool for ios
 - [ ] export tool for android
 - [ ] export tool for react 
 - [ ] localize tool using the tool :-)
 
 - [ ] sample values management tab?
 - [ ] oboarding
 - [ ] pricing overview 
 - [ ] blog

 
Daal
Mata
Palak


Plugins:
https://www.figma.com/community/plugin/864431140615310499/Transifex-Figma-Plugin
https://www.figma.com/community/plugin/818840482503404814/Lokalise
https://www.figma.com/community/plugin/803669834214399971/Phrase-Strings
https://www.figma.com/community/plugin/802555101361690489/Crowdin-for-Figma