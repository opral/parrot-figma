export default class GoogleTranslator {
  static async translate(text: string, sourceLanguage: string, targetLanguage: string) {
    // replace placeholder with numbers to not translate them

    const pattern = /(<ph type="([^"]*)")( format="([^"]*)")?( arg="([^"]*)")?( unnamed)?([^>])*(>([^<]*)<\/ph>)/g;

    const placeholderIndexMapping = [] as string[];
    let currentIndex = 0;

    // const wholeMatch = paramMatch[0];
    // const argumentPosition = paramMatch[1] ? parseInt(paramMatch[1], 10) : undefined;
    // const name = paramMatch[2];

    const textWithMaskedPlaceholders = text.replace(pattern, (match, _helper1, type, _helper3, format, _helper5, argumentPosition, unnamed, _helper8, _helper9, name) => {
      // const placeholderName = name;
      placeholderIndexMapping[currentIndex] = match;
      const placeholderReplacement = `[[${currentIndex}]]`;
      // eslint-disable-next-line no-plusplus
      currentIndex++;
      return placeholderReplacement;
    });

    const sentences = textWithMaskedPlaceholders.split('. ');
    const translatedSentences = [] as string[];
    for (const sentence of sentences) {
      // eslint-disable-next-line no-await-in-loop
      const result = await fetch(`https://translate.googleapis.com/translate_a/single?${new URLSearchParams({
        client: 'gtx',
        dt: 't',
        sl: sourceLanguage === 'se' ? 'SV' : sourceLanguage,
        tl: targetLanguage === 'se' ? 'SV' : targetLanguage,
        q: sentence.split('.').join('{{dot}}').split('#').join('{{route}}')
          .split('\n')
          .join('{{newline}}'),
      })}`, {
        method: 'GET',
        /* headers: {
                'origin-when-cross-origin': '*',
              }, */
      });
      // eslint-disable-next-line no-await-in-loop
      const translationResults = await result.json();
      translatedSentences.push(translationResults[0][0][0].split('{{dot}}').join('.').split('{{route}}').join('#')
        .split('{{newline}}')
        .join('\n'));
    }

    const translationWithMaskedPlaceholders = translatedSentences.join('. ');

    const patternMaskedPlaceholders = /\[\[([0-9]+)\]\]/g;

    // const wholeMatch = paramMatch[0];
    // const argumentPosition = paramMatch[1] ? parseInt(paramMatch[1], 10) : undefined;
    // const name = paramMatch[2];

    const translationWithoutPlaceholders = translationWithMaskedPlaceholders.replace(patternMaskedPlaceholders, (match, placeholderIndex, _argumentPosition) => `${placeholderIndexMapping[placeholderIndex]}`);

    return translationWithoutPlaceholders;
    /*
          // https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fr&dt=t&q=Hello
          // origin-when-cross-origin
          // console.log(`tranalating: ${text} with deepl`);
          const result = await fetch('http://localhost:3333/api/v1/translate', {
            method: 'POST',
             headers: {
                'Authorization': 'DeepL-Auth-Key 391733de-67e0-be65-a8b7-4298511dd564:fx'
              },
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              {
                text: [text],
                target_lang: targetLanguage === 'se' ? 'SV' : targetLanguage,
              },
            ),
          });
          const translationResults = await result.json();

          return translationResults.messages[0].text; */
  }
}
