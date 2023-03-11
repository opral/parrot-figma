/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';

import './SegmentedControl.css';

export interface Segment {
  iconName: string;
  value: string
}

type SegmentedControlProps<Type> = {
  selectedSegment: Type,
  segments: Segment[],
  onChoose: Function

};

export default function SegmentedControl<Type>({
  selectedSegment,
  segments,
  onChoose,
}: SegmentedControlProps<Type>) {
  const [selectedSegmentState, setSelectedSegment] = useState(selectedSegment);

  const handleSelectClick = (value: any) => {
    setSelectedSegment(value);
    onChoose(value);
  };

  return (
    <div className="segmented-control">
      {segments.map((segment) => (
        <div
          key={segment.value}
          className={`segmented-control-segment${segment.value === selectedSegmentState ? ' selected' : ''}`}
          onClick={() => handleSelectClick(segment.value)}
        >
          <div className={`svg-container ${segment.iconName}`} />
        </div>
      ))}

    </div>
  );
}
