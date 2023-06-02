/* eslint-disable no-plusplus */
import { Language } from '../base/Language';
import { Plural, getPluralFormsByLanguage } from '../base/Plural';
import {
  Fillins, HistoryEntry, Placeholder, PlaceholderType, PlaceholdersByName, TranslationKey, Translations,
} from './TranslationKey';

export interface UITranslationKeyStore {
  getBaseLanugage(): Language | undefined
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

  quantity: { value: number } | { placeholder: string };

  placeholders: PlaceholdersByName;

  defaultFillins: Fillins;

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
    this.quantity = key.quantity;
    this.placeholders = key.placeholders;
    this.defaultFillins = key.defaultFillins ? key.defaultFillins : {};
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
    const pattern = /\[\[([A-Za-z_]{2,})?(?:#(\d+))?(?::*([df])(?:\.(\d+))?)?\]\]/g;

    const parameters = [] as Placeholder[];
    let parameterNumber = 0;
    let unnamedIndex = 0;

    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = pattern.exec(text)) !== null) {
      let name = match[1];
      const argumentPosition = match[2] ? parseInt(match[2], 10) : undefined;
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
  static extractParameters(translations: Translations, baseLanguage: Language, includePluralForms: boolean) : PlaceholdersByName {
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
    if (translations[baseLanguage]) {
      // console.log('extracting baselanguage');
      UITranslationKey.extractPlaceholdersInLanguage(translations, baseLanguage, includePluralForms, processedPlaceholders, placeholdersWithArgumentPosition, placeholdersWithoutArgumentPosition);
    }

    for (const [language] of Object.entries(translations)) {
      if (language !== baseLanguage) {
        // console.log(`extracting language${baseLang}`);
        UITranslationKey.extractPlaceholdersInLanguage(translations, language as Language, includePluralForms, processedPlaceholders, placeholdersWithArgumentPosition, placeholdersWithoutArgumentPosition);
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

  private static extractPlaceholdersInLanguage(translations: Translations, language: Language, plurals: boolean, processedPlaceholders: { [placeholderName: string]: boolean; }, placeholdersWithArgumentPosition: Placeholder[], placeholdersWithoutArgumentPosition: Placeholder[]) {
    // plural priority is defined by the PluralFormsByLanguage map
    for (const plural of getPluralFormsByLanguage(language)) {
      if (!plurals && plural !== Plural.OTHER) {
        // eslint-disable-next-line no-continue
        continue;
      }
      if (translations[language]![plural]?.text) {
        const placeHoldersInText = UITranslationKey.extractPlaceholdersInText(translations[language]![plural]!.text!);
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
      quantity: this.quantity,
      defaultFillins: this.defaultFillins,
      placeholders: this.placeholders,
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

  /*
  fuzzyMatch(text: string) {
    for (const [language, languages] of Object.entries(this.translations)) {
      for (const plural of getPluralFormsByLanguage(language as Language)) {
        if (languages[plural]?.text !== undefined) {
          if (Math.abs(languages[plural]!.text!.length - text.length) > 30) { // TODO take parameters into account to define accepted difference in length
            // we skip labels with length not matching with a buffer of x
            continue;
          }

          // problem to solve: 
          // the strings from the design and from the keys provided do not match:
          // 1. a word is not starting with an upper case -> solved by comparing the lowercase version
          // 2. some characters don't match like a . is used instead of a !
          // 3. the key contains placeholders and the design contains fillins 
          // fuzzy match uses the distance of two strings -

          text
          const matchStartText = languages[plural]!.text!.toLowerCase().indexOf(text.toLowerCase());
          if ((query.exactText && matchStartText === 0 && languages[plural]!.text!.length === query.text.length)
            || (!query.exactText && matchStartText !== -1)) {
            if (!results.matches[key.keyName]) {
              results.matches[key.keyName] = { textMatches: {}, keyMatch: undefined };
            }

            if (!results.matches[key.keyName].textMatches![language as Language]) {
              results.matches[key.keyName].textMatches![language as Language]! = {};
            }
            results.matches[key.keyName].textMatches![language as Language]![plural as Plural] = { start: matchStartText, length: query.text.length };
            results.matchingKeys.add(key.keyName);
            results.inText.add(key.keyName);
          }
        }

        if (
          (key.plural || plural === Plural.OTHER)
          && (languages[plural] === undefined || (!languages[plural]?.skip && (!languages[plural]?.text || languages[plural]?.text === '')))) {
          results.withMissingTranslations.add(key.keyName);
        }

        if (languages[plural] && !languages[plural]!.verified) {
          results.withMissingReview.add(key.keyName);
        }
      }
    }
  }
  levenshteinDistance(text) => {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr = [];
    for (let i = 0; i <= t.length; i++) {
      arr[i] = [i];
      for (let j = 1; j <= s.length; j++) {
        arr[i][j] =
          i === 0
            ? j
            : Math.min(
                arr[i - 1][j] + 1,
                arr[i][j - 1] + 1,
                arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
              );
      }
    }
    return arr[t.length][s.length];
  };
  **/
}
