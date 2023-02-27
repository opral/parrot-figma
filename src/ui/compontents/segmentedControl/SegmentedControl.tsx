import * as React from "react";
import { useEffect, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import { Plural } from "../../../lib/base/Plural";
import { LocalizedLabel } from "../../../lib/localizedlabels/LocalizedLabel";

import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import Select, { SelectOption } from '../select/selsect'
import { MemoryTranslationKeyStore } from "../../../lib/keystore/MemoryTranslationKeyStore";
import { Language } from "../../../lib/base/Language";
import "./SegmentedControl.css"


export interface Segment {
    iconName: string;
    value: string
}

type SegmentedControlProps<Type> = {
    selectedSegment: Type,
    segments: Segment[],
    onChoose: Function
    
}

export default function SegmentedControl<Type>(props: SegmentedControlProps<Type>) {

    let [selectedSegment, setSelectedSegment] = useState(props.selectedSegment)


    const handleSelectClick = (value: any) => {
        setSelectedSegment(value);
        props.onChoose(value);
      };

    return (
        <div className="segmented-control">
            {props.segments.map(segment => {
                return (
                    <div key={segment.value} className={'segmented-control-segment' + (segment.value === selectedSegment ? ' selected' : '') } onClick={() => handleSelectClick(segment.value)} >
                        <div className={'svg-container ' + segment.iconName} />
                    </div>
                )
            })}
           
        </div>
    )
}