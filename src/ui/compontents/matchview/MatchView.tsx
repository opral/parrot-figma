import * as React from 'react';

type MatchViewProps = {
  match: { start: number, length: number } | undefined
  text: string
};

export default function MatchView({
  match,
  text,
}: MatchViewProps) {
  const regex = /\[\[(?:(\d+):)?([A-Za-z_]{2,})?(?::*([sdf])(?:\.(\d+))?)?\]\]/g; // TODO #8 this is what lokalise uses - to nerdy? think about [[]] for example

  const result = [];
  let lastEnd = 0;
  let paramMatch: any;
  let key = 0;
  // eslint-disable-next-line no-cond-assign
  while (paramMatch = regex.exec(text)) {
    const wholeMatch = paramMatch[0];
    const argumentPosition = paramMatch[1] ? parseInt(paramMatch[1], 10) : undefined;
    const name = paramMatch[2];

    const paramsRendered = (
      <React.Fragment key={key}>
        {text.substring(lastEnd, paramMatch.index)}
        <span style={{
          border: '1px solid blue',
          borderRadius: '4px',
          padding: '0 3px',
          background: 'lightblue',
        }}
        >
          { argumentPosition ? (`${argumentPosition}:${name}`) : name}
        </span>
      </React.Fragment>
    );

    result.push(paramsRendered);
    lastEnd = paramMatch.index + wholeMatch.length;

    key += 1;
  }

  if (result.length > 0) {
    result.push(<>{text.substring(lastEnd)}</>);
    return <>{result.map((el) => el)}</>;
  }

  if (match !== undefined) {
    return (
      <>
        {text.substring(0, match.start)}
        <mark className="match">{text.substring(match.start, match.start + match.length)}</mark>
        {text.substring(match.start + match.length)}
      </>
    );
  }
  return <span>{text}</span>;
}
