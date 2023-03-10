import { match } from "assert";
import * as React from "react";



type MatchViewProps = {
    match: { start: number, length: number } | undefined
    text: string
  }

  export default function MatchView(props: MatchViewProps) {
    if (props.match !== undefined) {
        return  (<>{props.text.substring(0, props.match.start)}
                    <mark className="match">{props.text.substring(props.match.start, props.match.start+props.match.length)}</mark>
                    {props.text.substring( props.match.start+props.match.length)}
                    </>)
    }
    return <span>{props.text}</span>
  }