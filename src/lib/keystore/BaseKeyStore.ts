import { Language } from "../base/Language";
import { Plural } from "../base/Plural";
import { FigmaLocaliziationHelper } from "../figmalocalization/FigmaLocaliziationHelper"
import { LocalizedLabel } from "../base/LocalizedLabel";
import { TranslationKey, TranslationKeys } from "../base/TranslationKey";

export class BaseTranslationKeyStore {

    stateByKey: TranslationKeys = { }
    protected localStateRaw: TranslationKey[] = [ ]

    public sampleValuesStateByKey: any = { }

    removeSamplePrefix(key: string) {
        return key.split(FigmaLocaliziationHelper.samplesPrefix + FigmaLocaliziationHelper.separator).join('');
    }

    private fillPlaceholdersWithSampleData(text: string, language: Language, plural: Plural) {
       
        const placeholders = new RegExp(`\\[%(s|n|i):(\\w+)\\]`, "g");
        return text.replace(placeholders, (substring, type, key) => {
          
            // exact match
            if (this.sampleValuesStateByKey[type + ':' + key]?.translations[language]?.[plural]?.text) {
                return this.sampleValuesStateByKey[type + ':' + key]?.translations[language][plural].text;
            }
            
            // name match
            if (this.sampleValuesStateByKey[key]?.translations[language]?.[plural]?.text) {
                return this.sampleValuesStateByKey[key]?.translations[language][plural].text;
            }

            // not found
            return substring;
            
        });
    }

    enrichLocalizationState(state: LocalizedLabel, language: Language) {

        if (state.text) {
            state.figmaTextFilled = this.fillPlaceholdersWithSampleData(state.text, language, state.pluralId as Plural);
        }

        if (!this.stateByKey[state.key]) {
            return
        }

        state.keyExists = true;
        let pluralForms = this.stateByKey[state.key].translations[language];

        state.translataions = {};
        console.log('enrivch')
        console.log(this.stateByKey[state.key])
        console.log(this.stateByKey[state.key].plurals);
        console.log(pluralForms);

        for (let plural of this.stateByKey[state.key].plurals) {
            state.translataions[plural] = {};
            

            console.log(pluralForms?.[plural]?.text);
            console.log(pluralForms);
            if (pluralForms && pluralForms[plural] && pluralForms[plural]!.text) {
                state.translataions[plural].translation = pluralForms[plural]!.text;
                state.translataions[plural].translationFilled = this.fillPlaceholdersWithSampleData(pluralForms[plural]!.text!, language , state.pluralId as Plural);
            }
        }

        state.plurals = this.stateByKey[state.key].plurals
        
    }

    async getLanguages() {
        return [Language.De, Language.En, Language.Bg]
    }

    async getStatesByKey() {
        return this.stateByKey;
    }

    async createFromKey(keyName: string, sourceKeyName: string) {
        throw 'createFromKey(keyName: string, sourceKeyName: string) - No localization state set yet'
    }

    async createKey(keyName: string, languageIso: string, plural: string, translation: string) {
        throw 'createKey(keyName: string, languageIso: string, plural: string, translation: string) - No localization state set yet'
    }

    async updateKey(keyName: string, languageIso: string, plural: string, translation: string) {
        throw 'updateKey(keyName: string, languageIso: string, plural: string, translation: string) - No localization state set yet'
    }

    async onCopyFromExisting(fromKey: string, toKey: string) {
        throw 'onCopyFromExisting(fromKey: string, toKey: string) - No localization state set yet'
    }

    async refreshState() {
        throw 'refreshState() - No localization state set yet'
    }


}
