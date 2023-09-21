
// Identical Pattern
 -> ref == target
 resolve: 
    - ignore
    - change text
// Missing Ref Variant - 
 -> ref == null 
  resolve:
     - delete
     - disable (variant not needed in language)
     - 
// missing variant
 -> variant Translation == null 
   resolve: 
    - disable variant - not needed in language

// Missing Review - 
 
// Outdated translation - the message variant has not changed after the reference has updated
 -> hash(ref variant) != targetVariant.sourceHash

 static forEachVariant(message: Message, refLocale: Locale, projectLocales: Locale[], variant: (locale: Locale, gender: Gender, plural: Plural, message: Message) => void) {
    
    // iterate through all Locales
    for (const locale of projectLocales) {
      const genders = !message.gender ? [Gender.NEUTRAL] : genderList;
      for (const gender of genders) {
        const plurals = message.plural && message.variants[refLocale]?.[gender] ? Object.keys(message.variants[refLocale]![gender]!) : [Plural.OTHER];
        for (const plural of plurals) {
          variant(locale, gender, plural as Plural, message);
        }
      }
    }
  }