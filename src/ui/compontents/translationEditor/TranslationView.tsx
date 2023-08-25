import * as React from 'react';
import { UITranslationKey } from '../../../lib/message/UITranslationKey';
import { PlaceholderView } from './PlaceholderView';

type TranslationViewProps = {
  match: { start: number, length: number } | undefined
  text: string
};

export default function TranslationView({
  match,
  text,
}: TranslationViewProps) {
  const result = [];
  const placeholders = UITranslationKey.extractPlaceholdersInText(text);
  const fixedPosition = 3; // TODO #8 source this from the keys parameters instead
  let lastEnd = 0;
  let placeHolderIndex = 0;
  for (const placeholder of placeholders) {
    const { specifiedArgumentPosition } = placeholder;
    const paramsRendered = (
      <React.Fragment key={placeholder.name + placeHolderIndex}>
        {text.substring(lastEnd, placeholder.positionInString)}
        <PlaceholderView
          name={placeholder.name}
          type={placeholder.type}
          specifiedArgumentPositon={specifiedArgumentPosition}
          decimalPlaces={placeholder.decimalPlaces}
          derivedArgumentPosition={fixedPosition}
          fillIn="TODO"
        />

      </React.Fragment>
    );
    placeHolderIndex += 1;

    result.push(paramsRendered);
    lastEnd = placeholder.positionInString + placeholder.length;

    // we do not mask if the cursor is placed within a placeholder
  }

  if (false && result.length > 0) {
    result.push(<>{text.substring(lastEnd)}</>);
    return <>{result.map((el) => el)}</>;
  }

  // if (match !== undefined) {
  //   return (
  //     <>
  //       {text.substring(0, match.start)}
  //       <mark className="match">{text.substring(match.start, match.start + match.length)}</mark>
  //       {text.substring(match.start + match.length)}
  //     </>
  //   );
  // }
 
  // 
  // 
  let htmlRepresentation = text;
  // TODO #23 updating the reder view
  htmlRepresentation = htmlRepresentation.split('\n').map((content, index, array) => {
    if (false && index === (array.length - 1) && content === '') {
      return '';
    }
    if (content === '') {
      return '<p><br></p>';
    }
    return '<p>' + content + '</p>'
  }).join('');
  return <span dangerouslySetInnerHTML={{__html:htmlRepresentation }}/>;
}
