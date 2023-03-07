import React, { useMemo } from 'react';
import * as Diff from 'diff';

type DiffStyles = {
  added: React.CSSProperties;
  removed: React.CSSProperties;
  default: React.CSSProperties;
};

const defaultStyle: DiffStyles = {
  added: {
    backgroundColor: 'lightgreen',
  },
  removed: {
    backgroundColor: 'salmon',
  },
  default: {},
};

export type StringDiffProps = {
  oldValue: string;
  newValue: string;
  styles?: DiffStyles;
  className?: string;
  component?: React.ElementType;
};

export const StringDiff: React.FC<StringDiffProps> = ({
  oldValue,
  newValue,
  styles = defaultStyle,
  className,
  component: Component = 'div',
}) => {
    console.log('----------------- StringDiff----------------')
    console.log(oldValue);
    
    console.log(newValue);
    
    
  const result = useMemo(() => {
    
    const diff = Diff.diffChars(oldValue, newValue);
    return diff.map((part, index) => {
      const style: React.CSSProperties = part.added
        ? styles.added
        : part.removed
        ? styles.removed
        : styles.default;

      return (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          style={style}
        >
          {part.value}
        </span>
      );
    });
  }, [oldValue, newValue]);
  return <Component className={className}>{result}</Component>;
};