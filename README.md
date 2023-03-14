
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


# Label synchronization
 - label has no version - was never synced - no sync needed

 - label has a verion older than one version less than the current - do nothing (manual update needed)
  - 

 - label has a version one version older than the current and the content has not changed - update

# Label state  #1
- no key (untracked)  - (unset)
    Design View
    - [ ] option to search for the key 
    - [ ] enter a key
        - [x] create key if name is not used yet - version set to the one of the key
        - [ ] handle possible states if key exists
            - [ ] text matches - set version to the one of the key
            - [ ] text differes - prompt user and ask if 
                - [ ] want to use key version in dsign 
                - [ ] create a new key version from design text? 
                - [ ] just link the key 
    
    Key View - on translation updated
    - [x] nothing to do 

- commited/unchanged
    Design View
    - [x] behind - option to update text to the current version
        - [x] ui
        - [x] implementation
    - [ ] no difference - nothing to show

    Key View - on translation updated
    - [ ] behind - show behind in usage state
    - [ ] no differences - update with key 

    
- modified (maybe also behind)
    Design View
    - behind
        - [x] overide with latest version from key
            - [x] ui
            - [x] implementation
        - [x] revert to last version (-> commited/unchanged behind)
            - [x] ui
            - [x] implementation
        - [x] update key - create new key version from design
            - [x] ui
            - [x] implementation
 
    - up to date (pointing to latest key version)
        - [x] revert changes in design
            - [x] ui
            - [x] implementation
        - [x] update key - create new key version from design
            - [x] ui
            - [x] implementation
    
    Key View - on translation updated
    - [ ] behind - show behind in usage state
    - [ ] nothing to do


- Key View - on key name updated
    - [ ] update key in all labels 

# Language property

Currently the implementation allows one language per frame. This implementation has following downsides:
- If a lable is moved from the parent frame to another frame (moved or copied) it looses the language information
    - the language of the label would fall back to the base language and its text would most likly differ and show an incorrect change
- If a label is in state changed and a frame changes the language we cant keep the conflicting label

Solution: 

We store the language per label and per frame. When the frame changes it will try to change all label's languages. If a label
is in coflicting state it will not change its language and the ui will have to reflect this and give the user the posibility
to change the language in a later stage. 

Changes:
The point of truth for synchronization is the language of the label

Todos: 

 - [x] specify languages for file
 - [x] specfify base language 
 - [x] show baselanguage in lokalised key always on top 
 - [x] make header columns fixed size based on maximum column content
 - [x] allow the user to resolve the apply conflicts 
 - [ ] handle automatic design update based on version
 - [ ] allow user to select a key for a label
 - [ ] define language handling per label (if a lable is in state changed a language switch may not work for that label only)
 - [ ] plural select
 - [ ] variable replacement logic

 - [ ] allow to add a key manually 
 - [ ] selectiion - delete

 - [ ] distinct visual style for base language like bold
 - [ ] translation editor ux - we should be able to hide skipped values from option in toolbar
 - [ ] allow to rename keys

 - [ ] fix order
 - [ ] fix window manager bugs
    - [ ] window jumps when viewport is zoomed
    - [ ] if zoomfactor is to small sizing glitches
    - [ ] propagate viewport height via css variables (https://www.w3schools.com/css/css3_variables_javascript.asp)
 - [ ] Add tooltips 

 - [ ] key propagation from sandbox (multi user test)
 - [ ] history (who changed what when?) 
 - [ ] qa handling of translation
 - [ ] filter - match case, need review etc based on figmas search design

 - [ ] use base language for translation if possible
 
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

 - [ ] add platforms (ios/android/web/other)
 - [ ] allow each key to select plattforms
 - [ ] add tags
 - [ ] base default plurals per language based on unicodes: https://www.unicode.org/cldr/cldr-aux/charts/29/supplemental/language_plural_rules.html

 
Daal
Mata
Palak


Plugins:
https://www.figma.com/community/plugin/864431140615310499/Transifex-Figma-Plugin
https://www.figma.com/community/plugin/818840482503404814/Lokalise
https://www.figma.com/community/plugin/803669834214399971/Phrase-Strings
https://www.figma.com/community/plugin/802555101361690489/Crowdin-for-Figma


Good resources:
https://lokalise.com/blog/translation-keys-naming-and-organizing/?_ga=2.146791028.1532926386.1678634873-760110088.1676107100&_gac=1.254585466.1676366321.CjwKCAiA_6yfBhBNEiwAkmXy5xG_96z9c7XBYCXIcA1BDAndri1psVhtUrW-CoVUqjLWRe6gBMaPLhoCCOIQAvD_BwE

https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes



Martin tschirsisch 
