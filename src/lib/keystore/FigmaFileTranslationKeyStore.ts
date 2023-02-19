import { Language } from "../base/Language";
import { Plural } from "../base/Plural";
import { FigmaLocaliziationHelper } from "../figmalocalization/FigmaLocaliziationHelper"

import { LocalizedLabel } from "../base/LocalizedLabel";
import { BaseTranslationKeyStore } from "./BaseKeyStore"
import { TranslationKey, TranslationKeys } from "../base/TranslationKey";

const sharedPluginDataNS = 'assetsAndResources'
const localiszationKeysKey = 'localiszationKeys'


export class FigmaFileKeyStore extends BaseTranslationKeyStore {

    loaded = false

    async createKey(keyName: string, languageIso: string, plural: string, translation: string) {
        await this.createKeyWithTranslations(keyName, [{ language_iso: languageIso, plural: plural, translation: translation}])
    }

    async updateKey(keyName: string, languageIso: string, plural: string, translation: string) {
        await this.updateKeyWithTranslations(keyName, [{ language_iso: languageIso, plural: plural, translation: translation}])
    }

    async createKeyWithTranslations(keyName: string, translations: {language_iso: string, plural: string, translation: string}[]) {

        if (this.stateByKey[keyName]) {
            console.log(JSON.stringify(this.stateByKey, undefined, 4))
            throw Error("tried to create a key that already existed");
        }

        let plurals = [] as Plural[];

        let translationsObj = {} as any;
        for (let translation of translations) {
            if (!translationsObj[translation.language_iso]) {
                translationsObj[translation.language_iso] = {};
            }

            if (!translationsObj[translation.language_iso][translation.plural]) {
                translationsObj[translation.language_iso][translation.plural] = {};
            }

            translationsObj[translation.language_iso][translation.plural].text = translation.translation

            if (plurals.indexOf(translation.plural as Plural) === -1) {
                plurals.push(translation.plural as Plural)
            }
        }

        let createdKey = {
            keyName: keyName,
            tags: [],
            plurals: plurals,
            translations: translationsObj
        } as TranslationKey
        this.localStateRaw.push(createdKey);
        this.stateByKey[keyName] = createdKey
        if (keyName.indexOf(FigmaLocaliziationHelper.samplesPrefix) === 0) {
            this.sampleValuesStateByKey[this.removeSamplePrefix(keyName)] = this.stateByKey[keyName]
        }

        this.saveLocalState();
    }
    
    async updateKeyWithTranslations(keyName: string, translations: {language_iso: string, plural: string, translation: string}[]) {
        let localState = this.stateByKey[keyName];

        if (!localState) {
            throw "Key ["+keyName+"] not found!"
        }

        

        for (let translation of translations) {
            if (!localState.translations[translation.language_iso as Language]) {
                localState.translations[translation.language_iso as Language] = { 'other' : {}};
            }

            if (!localState.translations[translation.language_iso as Language]![translation.plural as Plural]) {
                localState.translations[translation.language_iso as Language]![translation.plural as Plural] = { };
            }

            localState.translations[translation.language_iso as Language]![translation.plural as Plural]!.text = translation.translation;

            if (localState.plurals.indexOf(translation.plural as Plural) === -1) {
                console.log('adding plural' + translation.plural)
                localState.plurals.push(translation.plural  as Plural   );
            } else {
                console.log('plural existed' + translation.plural)
            }
            
        }
        
        if (keyName.indexOf(FigmaLocaliziationHelper.samplesPrefix) === 0) {
            this.sampleValuesStateByKey[this.removeSamplePrefix(keyName)] = this.stateByKey[keyName]
        }
        let keyIndex = this.localStateRaw.findIndex((el: any) => el.keyName == keyName);
        this.localStateRaw[keyIndex] = this.stateByKey[keyName];

        console.log( this.stateByKey[keyName])
        console.log(localState);

        this.saveLocalState();
    }

    async onCopyFromExisting(fromKey: string, toKey: string) {
        /* legacy console.log('onCopyFrommExisting');
        if (!this.stateByKey[fromKey]) {
            throw Error('tried to copy from a non existing key');
        }

        let copyFrom = this.stateByKey[fromKey];
        
        try {
            let translations = [] as {language_iso: string, plural: string, translation: string}[];
            for (let language_iso of Object.keys(copyFrom.translations)) {
                for (let plural of Object.keys(copyFrom.translations[language_iso as Language])) {
                    let text = copyFrom.translations[language_iso as Language][plural as Plural].text 
                    if (text)
                    translations.push({language_iso: language_iso, plural: plural, translation: text})
                }
            }

            if (!this.stateByKey[toKey]) {
                // create it with translations
                await this.createKeyWithTranslations(toKey, translations);
            } else {
                // update it 
                await this.updateKeyWithTranslations(toKey, translations)
            }
        } catch(e) {
            console.error(e);
        }
        */
    }

    async saveLocalState() {
        figma.root.setSharedPluginData(sharedPluginDataNS, localiszationKeysKey, JSON.stringify(this.localStateRaw));
        console.log('local state saved');
    }

    async refreshState() {

        let keysResultsJson = figma.root.getSharedPluginData(sharedPluginDataNS, localiszationKeysKey);
        
        console.log(keysResultsJson)
        let keysResult = keysResultsJson ? JSON.parse(keysResultsJson) : [];

        let stateByKey: TranslationKeys = {};
        let sampleValuesStateByKey: any = {};
        for (let key of keysResult) {

        
            if (stateByKey[key.keyName]) {
                console.warn('dublicate keyname found: ' + key.keyName + ' in key ' + stateByKey[key.key_name].keyName + ' and ' + key.keyName);
            }

            stateByKey[key.keyName] = {
                keyName: key.keyName,
                plurals: key.plurals,
                translations: key.translations
            }

            if (key.keyName.indexOf(FigmaLocaliziationHelper.samplesPrefix) === 0) {
                sampleValuesStateByKey[this.removeSamplePrefix(key.key_name)] = {
                    keyName: key.keyName,
                    translations: key.translations
                }
            }

        }

        this.localStateRaw = keysResult
        this.stateByKey = stateByKey
        this.sampleValuesStateByKey = sampleValuesStateByKey;
        this.loaded = true
        
    }
}