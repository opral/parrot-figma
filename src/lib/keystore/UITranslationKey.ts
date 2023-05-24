/* eslint-disable no-plusplus */
import { Language } from '../base/Language';
import { Plural, getPluralFormsByLanguage } from '../base/Plural';
import { HistoryEntry, TranslationKey } from './TranslationKey';

export interface UITranslationKeyStore {
  getBaseLanugage(): Language | undefined
}

export enum PlaceholderType {
  string = 's',
  float = 'f',
  integer = 'd',
}

export interface Placeholder {
  name: string, // name of the placeholder - always preferred to have one but optional as some imports do not provide this
  named: boolean, // false if no name provided
  type: PlaceholderType, // s: string | f: float | d: decimal
  decimalPlaces: undefined | number, // in case of type float this gives the number of decimal places after the .
  specifiedArgumentPosition: undefined | number, // if defined the position to provide the argument at when using printf for example
  derivedArgumentPosition: undefined | number, // the argument position derived by analyzing all translations
  parameterNumber: number // the 0-based position the parameter apeared. in a string like "Hello [[first_name]] [[last_name]]" first_name would get 0, last_name would get 1.

  // the argumentPosition is fixed by the first apearance - this can lead to conflicts like same parameter has different arumentPostions set or multiple placeholders block the same position
  // in such cases it will be ignored
  positionSpecifiedByLanguage?: Language,
  positionSpecifiedInPlural?: Plural,

  positionInString: number,
  length: number,
}

export class UITranslationKey implements TranslationKey {
  keyName: string;

  latestVersion: number;

  historyTags: {
    // map a tag identifier (we use a number for size reasons) to a version index of a key
    [tagIndex: number]: number;
  };

  plural: boolean;

  labels: string[];

  translations: {
    [language in Language]? : {
      [plural in Plural]? : {
        version: number,
        text?: string,
        verified: boolean,
        skip: boolean
      }
    }
  };

  history: HistoryEntry[];

  keyStore: UITranslationKeyStore;

  constructor(keyStore: UITranslationKeyStore, key: TranslationKey) {
    this.keyStore = keyStore;

    this.keyName = key.keyName;
    this.latestVersion = key.latestVersion;
    this.historyTags = key.historyTags;
    this.plural = key.plural;
    this.labels = key.labels;
    this.translations = key.translations;
    this.history = key.history;
  }

  getHistoryEntry(language: Language, plural: Plural, version: number) : HistoryEntry | undefined {
    // iterate backward until we have a match
    let currentVersion = version;
    while (currentVersion >= 0) {
      if (this.history[currentVersion]?.translations?.[language]?.[plural]) {
        return this.history[currentVersion];
      }
      currentVersion -= 1;
    }
    return undefined;
  }

  getChangesSince(language: Language, plural: Plural, version: number) {
    let changeCounter = 0;

    let currentVersion = this.latestVersion;
    while (currentVersion >= 0 && currentVersion > version) {
      if (this.history[currentVersion]?.translations?.[language]?.[plural]) {
        changeCounter += 1;
      }
      currentVersion -= 1;
    }
    return changeCounter;
  }

  static extractPlaceholdersInText(text: string): Placeholder[] {
    // Regular expression to match parameter placeholders in the format [[argumentPosition:name:type.decimalPlaces]]
    // \[\[                Matches the opening double square brackets
    // (?:(\d+):)?         Non-capturing group for optional argumentPosition followed by a colon
    //                     (\d+) captures one or more digits as argumentPosition
    // ([A-Za-z_]{2,})?    Captures name consisting of at least two letters or underscores
    // (?::*([sdf])        Non-capturing group for optional type preceded by one or more colons
    //                     ([sdf]) captures s, d, or f as type
    // (?:\.(\d+))?        Non-capturing group for optional decimalPlaces preceded by a dot
    //                     (\d+) captures one or more digits as decimalPlaces
    // \]\]                Matches the closing double square brackets
    const pattern = /\[\[(?:(\d+):)?([A-Za-z_]{2,})?(?::*([sdf])(?:\.(\d+))?)?\]\]/g;

    const parameters = [] as Placeholder[];
    let parameterNumber = 0;
    let unnamedIndex = 0;

    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = pattern.exec(text)) !== null) {
      const argumentPosition = match[1] ? parseInt(match[1], 10) : undefined;
      let name = match[2];
      let named = true;
      if (!name) {
        unnamedIndex += 1;
        named = false;
        name = `unnamed_parameter__${unnamedIndex}`;
      }

      const type = (match[3] || 's') as PlaceholderType;
      const decimalPlaces = match[4] ? parseInt(match[4], 10) : undefined;

      parameters.push({
        named,
        name,
        type,
        derivedArgumentPosition: undefined,
        parameterNumber,
        decimalPlaces,
        specifiedArgumentPosition: argumentPosition,
        positionInString: match.index,
        length: match[0].length,
      });
      parameterNumber++;
    }

    return parameters;
  }

  /**
   * Placeholder index:
   * The placeholder format should always have a type. The position index as well as the name is optional.
   *
   * The output will *always* create a positioned index. The logic for the indexing is the following:
   *
   * ## The base language takes care of the indexing. Current Index + 1 on the first apearance of a named key:
   *  "[%s:separator] [%s:name] [%s:separator] [%s:firstname]" -> 1:name 2:separator 3:firstname
   *
   * ## If a placehodlder is introduced in a plural we add the index in the order OTHER -> ZERO -> MANY if an argument position is provided it will be taken
   *
   * Example:
   * - OTHER: "You have [[number_of_kids:d]] Kids "
   * - ZERO:  "You plan to give your first child the name [[first_child_name]]"
   * - ONE:   "You have [[number_of_kids:d]] Kid her name is [[first_child_name]] your next kid will be named [[1:second_child_name]]"
   *
   * This will start with Other, and find "number_of_kids",  followed by Zero which introduces "first_child_name".
   * -> If ony those two forms would have been introduced the order would be 1:number_of_kids, 2:first_child_name
   * Since the plural one introduces second_child with a fixed position 1 the resulting params will be like:
   * 1:second_child_name 2:number_of_kids, 3:first_child_name
   *
   * The placeholders argument number abrivation continues with the languages:
   *
   * If a placehodlder is introduced in a language other than the base language we add the index by language alphabetically
   * Example:
   * - EN: "[[firstname]] "
   * - DE: "[[title]] [[firstname]] [[lastname]]"
   * - SE: "[[form_of_address]] [[lastname]] [[firstname]]"
   * -> In this example EN is the base language so we use its translation first and we give firstname index number 1:
   *   -> 1:firstname
   * -> The next language, now after the alphabet, is german. this results in index 2 for title and index 3 for lastname
   *   -> 1:firstname 2:title 3:lastname
   * -> With the last language, Swedish, another parameter "form_of_address" is introduced. Its index is according to 4
   *   -> 1:firstname 2:title 3:lastname 4:form_of_address
   *
   * Conflicting argument positions:
   * A conflicting argument postions will be ignored for index building - first index wins. A warning should be shown to the user.
   * Example:
   *
   * - a conflict
   *
   * If a placehodlder is introduced in a language other than the base language we add the index by language alphabetically
   * - EN: "[%s:firstname] "
   * - DE: "[%s:title] [%s:firstname] [%s:lastname]"
   * - SE: "[%s:form_of_address] [%s:lastname] [%s:firstname]"
   * -> In this example EN is the base language so we use its translation first and we give firstname index number 1:
   *   -> 1:firstname
   * -> The next language, now after the alphabet, is german. this results in index 2 for title and index 3 for lastname
   *   -> 1:firstname 2:title 3:lastname
   * -> With the last language, Swedish, another parameter "form_of_address" is introduced. Its index is according to 4
   *   -> 1:firstname 2:title 3:lastname 4:form_of_address
   *
   * This rule also applies for plurals. The Order here is baselang, Other, One ... alphatbetic string
   *
   * Parameters may only containe alphabetic charactes and underscores.
   *
   * Open question: do we need a list of parameters per translation?
   * - How do we know that a text misses a parameter?
   *    - we check if all parameters defined in the base language are provided?
   *    - do we check more languages than the base language?
   * - how shall we flag false positives - parameters that are not needed in a specific language?
   *
   */
  extractParameters() : {
    [placeholderName: string] : Placeholder
  } {
    const baseLang = this.keyStore.getBaseLanugage();

    if (!baseLang) {
      throw new Error('extractParameters expects a baselanguage configured');
    }

    // a placeholder can be processed in two ways:
    // 1. with a argument postion [[1:...]]
    // - the first placeholder with a specific argument postion wins
    // - later ones are ignored
    // 2. with no fixed position [[name/noName]]
    // - if no fixed position is found the order of its apearance will be considered
    // if a parameter was processed without an argument postion but a later apearance provides
    // this information it should no longer influence other placehpolders apearance index.
    const processedPlaceholders = {
    } as {
      [placeholderName: string] : boolean // true: with fixed position, false: without fixed position
    };
    const placeholdersWithoutArgumentPosition = [] as Placeholder[];
    const placeholdersWithArgumentPosition = [] as Placeholder[];
    const placeholders = {} as {
      [placeholderName: string] : Placeholder
    };

    // base lang has priority
    if (this.translations[baseLang]) {
      console.log('extracting baselanguage');
      this.extractPlaceholdersInLanguage(baseLang, processedPlaceholders, placeholdersWithArgumentPosition, placeholdersWithoutArgumentPosition);
    }

    for (const [language] of Object.entries(this.translations)) {
      if (language !== baseLang) {
        console.log(`extracting language${baseLang}`);
        this.extractPlaceholdersInLanguage(language as Language, processedPlaceholders, placeholdersWithArgumentPosition, placeholdersWithoutArgumentPosition);
      }
    }

    // Okay we have two arrays now. one with fixed positions and one that should fill up the empty spaces - so lets try to fill it up
    for (let currentPosition = 1; currentPosition < placeholdersWithArgumentPosition.length; currentPosition++) {
      if (placeholdersWithArgumentPosition[currentPosition] === undefined) {
        const nextFillInPlaceholder = placeholdersWithoutArgumentPosition.shift();
        if (nextFillInPlaceholder) {
          placeholdersWithArgumentPosition[currentPosition] = nextFillInPlaceholder;
          nextFillInPlaceholder.derivedArgumentPosition = currentPosition;
          placeholders[placeholdersWithArgumentPosition[currentPosition].name] = placeholdersWithArgumentPosition[currentPosition];
        } else {
          // ok lets remove this element from the array
          placeholdersWithArgumentPosition.splice(currentPosition, 1);
          // we got to step back one step to hit the next element correctly
          currentPosition--;
        }
      } else {
        // ok slot is already taken - set derived argument Position  for the placeholder
        placeholdersWithArgumentPosition[currentPosition].derivedArgumentPosition = currentPosition;
        placeholders[placeholdersWithArgumentPosition[currentPosition].name] = placeholdersWithArgumentPosition[currentPosition];
      }
    }

    // add the left over fillings
    let nextFillinPlaceholder;
    // eslint-disable-next-line no-cond-assign
    while (nextFillinPlaceholder = placeholdersWithoutArgumentPosition.shift()) {
      nextFillinPlaceholder.derivedArgumentPosition = placeholdersWithArgumentPosition.length;
      placeholdersWithArgumentPosition.push(nextFillinPlaceholder);
      placeholders[nextFillinPlaceholder.name] = nextFillinPlaceholder;
    }

    return placeholders;
  }

  private extractPlaceholdersInLanguage(language: Language, processedPlaceholders: { [placeholderName: string]: boolean; }, placeholdersWithArgumentPosition: Placeholder[], placeholdersWithoutArgumentPosition: Placeholder[]) {
    // plural priority is defined by the PluralFormsByLanguage map
    for (const plural of getPluralFormsByLanguage(language)) {
      if (this.translations[language]![plural]?.text) {
        const placeHoldersInText = UITranslationKey.extractPlaceholdersInText(this.translations[language]![plural]!.text!);
        for (const placeHolderInText of placeHoldersInText) {
          if (processedPlaceholders[placeHolderInText.name] === true) {
            // NOTHING TO DO - placeholder got a fixed position already;
          } else if (processedPlaceholders[placeHolderInText.name] === false) {
            if (placeHolderInText.specifiedArgumentPosition !== undefined && !placeholdersWithArgumentPosition[placeHolderInText.specifiedArgumentPosition]) {
              // placeholder has a fixed argument position and the slot is available
              const previosIndex = placeholdersWithoutArgumentPosition.findIndex((placeholder) => placeholder.name === placeHolderInText.name);
              placeholdersWithoutArgumentPosition.splice(previosIndex, 1);
              // eslint-disable-next-line no-param-reassign -- we explicetly call by reference here
              placeholdersWithArgumentPosition[placeHolderInText.specifiedArgumentPosition] = placeHolderInText;
              // eslint-disable-next-line no-param-reassign
              processedPlaceholders[placeHolderInText.name] = true;
            } else {
              // NOTHING TO DO - was already processed and the additional information - argument position doesn't change anything since the slot is not free anymore
            }
          } else if (placeHolderInText.specifiedArgumentPosition !== undefined && !placeholdersWithArgumentPosition[placeHolderInText.specifiedArgumentPosition]) {
            // the placeholder has not yet proccessed, it has a fixed argument position that is still available
            // eslint-disable-next-line no-param-reassign -- we explicetly call by reference here
            placeholdersWithArgumentPosition[placeHolderInText.specifiedArgumentPosition] = placeHolderInText;
            // eslint-disable-next-line no-param-reassign -- we explicetly call by reference here
            processedPlaceholders[placeHolderInText.name] = true;
          } else {
            // the placeholder has not yet been processed and it has no argument position or the provided ones slot is not free - add to fill in placeholders for now
            placeholdersWithoutArgumentPosition.push(placeHolderInText);
            // eslint-disable-next-line no-param-reassign -- we explicetly call by reference here
            processedPlaceholders[placeHolderInText.name] = false;
          }
        }
      }
    }
  }

  getPlaceholders() {
    return this.extractParameters();
  }

  getKeyVersionByTagIndex(tagIndex: number) {
    return this.historyTags[tagIndex];
  }

  /**
   * Allows to get this key in a specific version. All properties and translations/plurals will be returned in the
   * version passed as version parameter
   * @param version the version to return the key in
   * @returns
   */
  getInVersion(version: number) {
    const translationKeyInVersion = {
      keyName: this.keyName,
      latestVersion: this.latestVersion,
      historyTags: this.historyTags,
      labels: [],
      plural: false,
      history: [],
      translations: {},
    } as TranslationKey;

    for (let versionI = 0; versionI < version; versionI++) {
      const currentVersion = this.history[versionI];

      // translationKeyInVersion.history.push(currentVersion);
      translationKeyInVersion.plural = currentVersion.plural ?? translationKeyInVersion.plural;
      translationKeyInVersion.labels = currentVersion.labels ?? translationKeyInVersion.labels;

      if (!currentVersion.translations) {
        // eslint-disable-next-line no-continue -- we want to skip the next processing in case this version doesn't change the translations
        continue;
      }

      for (const [languageId, language] of Object.entries(currentVersion.translations)) {
        if (!translationKeyInVersion.translations[languageId as Language]) {
          translationKeyInVersion.translations[languageId as Language] = {};
        }

        for (const [pluralId, plural] of Object.entries(language)) {
          if (!translationKeyInVersion.translations[languageId as Language]![pluralId as Plural]) {
            translationKeyInVersion.translations[languageId as Language]![pluralId as Plural] = {
              skip: plural.skip!,
              verified: plural.verified ?? false,
              text: plural.text,
              version: versionI,
            };
          } else {
            const currentPlural = translationKeyInVersion.translations[languageId as Language]![pluralId as Plural]!;
            currentPlural.skip = plural.skip ?? currentPlural.skip;
            currentPlural.version = versionI;
            currentPlural.verified = plural.verified ?? currentPlural.verified;
            currentPlural.text = plural.text ?? currentPlural.text;
          }
        }
      }
    }

    return translationKeyInVersion;
  }
}
