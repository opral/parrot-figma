
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

# Versioning

The way we comunicate changes over time from the first steps of a welcome message "Hi user" to "Great to have you". A keys value does change correspondinly. To keep track of the different representation a user received keys play a major role. "How did we introduce this feature to the user when we first released it?" "We thought about that text but we decided to drop that idea because of...". 

To answer those questions the extension keeps track of the changes of keys over time. 
It should allow to grasp an overview of states from released version down to individual changes.

To be able to achive this we keep a version counter for each key. Each change of each language/plural will increment this counter and store the new version in the history array at the version position. 

Version 1 (user creates key_1 for de/other):

Key:
key_1 - de - other "Hallo wie gehts?"

versions: 
[
    key_1 - de - other "Hallo wie gehts?",
]


Version 2 (user adds a translation for the language en):
key_1 - de - other "Hallo wie gehts?"
key_1 - en - other "Hello how are you?"


versions: 
[
    de - other "Hallo wie gehts?",
    en - other "Hello how are you?"
]




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

## UI: 
- Frame                              EN

    - Label with changes            EN
    - Label with 1+ behind          EN
    - Label in sync with            CZ
    - Label in sync                 EN
    - Label with no DE translation  EN

Frame language changed to DE

- Frame                             DE 

    - Label with changes            EN (sticks to english because of outstandign changes) open q: when to switch to DE? never / when changes are handled?
    - Label with 1+ behind          DE (save to switch language - so we do it still one behind) 
    - Label in sync with            DE (no need to not sync it back in) 
    - Label in sync                 DE (easy)
    - Label with no DE translation  DE (changes to german but with changed state no revert back but use label)





# Use sample values property
The useSampleValues property was stored on frames first the problem is very similiar to the language problem. 

What we want from ui point of view: 
- The user want to toggle the whole frame 
    - all view should be configured to render or not render sample values

## UI:
 - Frame                                [X] <- click deactivates all
    - Label with sampleValues active    [X]
    - Label with sampleValues active    [X]


 - Frame                                [ ] <- click activates all 
    - Label with sampleValues active    [ ]
    - Label with sampleValues active    [ ]

 - Frame                                [ ] <- click activates all (symbol greyed out to indicate not representative)
    - Label with sampleValues active    [X]
    - Label with sampleValues inactive  [ ]

# Onboarding

- select the base language
- select the languages you want to translate the designfile to
- select the platforms the designs should be used in (ios / android / web / ... ) - this will preconfigure the export eventually
- import existing key file (ios/android)

# Todos: 

 - [x] specify languages for file
 - [x] specfify base language 
 - [x] show baselanguage in localised key always on top 
 - [x] make header columns fixed size based on maximum column content
 - [x] allow the user to resolve the apply conflicts 
 - [x] define language handling per label (if a lable is in state changed a language switch may not work for that label only)
 - [x] allow user to select a key for a label 
    - [x] top down drawer window
    - [x] hide usage 
    - [x] hide multiselect
 - [x] ensure only one open editor - tbd what to do with current active editor with due changes - we save the changes since we have versioning
 - [x] better no keys - empty list messages (no search results / no keys at all) 
 - [x] add revert button to history
 - [x] when checking for behind always use the  frames language instead of the labels one to detect a ne translation that gets added and allow to switch language by updating instance
 - [x] fix order in label screen
 - [x] fix window manager bugs
    - [x] window jumps when viewport is zoomed
    - [x] if zoomfactor is to small sizing glitches
    - [x] propagate viewport height via css variables (https://www.w3schools.com/css/css3_variables_javascript.asp)
 - [x] handle empty text in translation as mising translation '' == undefined
 - [x] fix flicker on zoom

  
 - [x] localize tool using the tool :-) POC
 - [x] Add tooltips 

 - [ ] polish mouse pointer styles
 - [ ] check keyname for at least one visible character
 - [ ] focus key field on link click if no derviation is posible
 - [ ] last character bug in key editor
 - [ ] add show difference toggle to history view
 - [ ] plural select
 - [ ] UX key select
    - [ ] search by key "key:keyname or other"
    - [ ] show only base language and current frame language
    - [ ] add single line action button "use key"
 
 - [ ] fix localized label row design
    - [ ] do we need to edit or even show the complete text inline in the designs tab?
    - [ ] plural select (should it be visible if there is only the other option?)
    - [ ] distinct visual style for base language like bold

 - [ ] allow to add a key manually using drawer? Currently one can only create a key form a lable 

 - [ ] add automatic design update for labels with state modified == false && behind == 0 - feedback?
 - [ ] translation editor ux - we should be able to hide skipped values from option in toolbar
 
 - [ ] delete selection (multi select)

 
 - [ ] variable replacement logic
    - [ ] placeholder style
    

 - [ ] #3 implement fallback mechanism (plural skipped -> other -> other skipped -> base lang plural -> base lang plural skipped -> base lang other ) 
    - [ ] does the label need to know what it falled back to - how can synchonization handle that?

 - [x] key propagation from sandbox (multi user test)
 - [ ] history (who changed what when?) 
 - [ ] allow to rename keys
    - [ ] think about edgecases here 
 - [ ] qa handling of translation
 - [ ] filter - match case, need review etc based on figmas search design

 - [ ] use base language for translation if possible
 - [ ] handle selection for keys as well (provide an option to only show keys of current selection)

#### import
 - [ ] import of ios dict
    - files sitting in de.lproj / en.lproj foldern that contain two files
        - [x] *.strings a simple key value fule "key" = "value" while i guess newlines and '"' are encoded somehow
        - *.stringsdict file containing xml structure for plurals
 - [ ] import of android dict
    - android has multiple xml files per language - it separates by folders on drop we can check the folders postfix for the language values-de would be the german strings - we don't know the language for values so
    - files are in xml format so we need to parse it
 - [ ] file import ui
    - drop area for files 
    - import action screen that allows to choose a language and choose the import option
        - ignore new keys (number of keys affected)
        - override existing keys (number of keys affected)
        - ignor existing keys 
        - match by content and add platform specific keys
 - [ ] import from lokalize
 
 #### Export
 - [ ] add export tab with versioning
 - [ ] export tool for ios
 - [ ] export tool for android
 - [ ] export tool for react 
 
 - [ ] sample values management tab?
 - [ ] onboarding
 - [ ] pricing overview 
 - [ ] blog

 - [ ] add platforms (ios/android/web/other)
 - [ ] allow each key to select plattforms
 - [ ] darkmode

 ### After MVP
 - [ ] base default plurals per language on unicodes: https://www.unicode.org/cldr/cldr-aux/charts/29/supplemental/language_plural_rules.html
 - [ ] add tags

Plugins:
https://www.figma.com/community/plugin/864431140615310499/Transifex-Figma-Plugin
https://www.figma.com/community/plugin/818840482503404814/Lokalise
https://www.figma.com/community/plugin/803669834214399971/Phrase-Strings
https://www.figma.com/community/plugin/802555101361690489/Crowdin-for-Figma


Good resources:
https://lokalise.com/blog/translation-keys-naming-and-organizing/?_ga=2.146791028.1532926386.1678634873-760110088.1676107100&_gac=1.254585466.1676366321.CjwKCAiA_6yfBhBNEiwAkmXy5xG_96z9c7XBYCXIcA1BDAndri1psVhtUrW-CoVUqjLWRe6gBMaPLhoCCOIQAvD_BwE

https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes



