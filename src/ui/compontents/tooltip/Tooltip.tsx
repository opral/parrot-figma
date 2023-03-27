import React, { useState, useEffect, useRef } from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import './Tooltip.css';

interface TooltipProps {
  triggerAttribute: string;
  contentAttribute: string;
}

export default function Tooltip({ triggerAttribute, contentAttribute }: TooltipProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipVisibleRef = useRef(tooltipVisible);
  tooltipVisibleRef.current = tooltipVisible;
  const [tooltipContent, setTooltipContent] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number, left: number }>({ top: 0, left: 0 });
  const hideTooltipTimeoutRef = useRef<number | undefined>(undefined);
  const showTooltipTimeoutRef = useRef<number | undefined>(undefined);

  const hideTimeout = 600;
  const showTimeout = 1000;

  const handleMouseLeave = () => {
    if (showTooltipTimeoutRef.current) {
      clearTimeout(showTooltipTimeoutRef.current);
      showTooltipTimeoutRef.current = undefined;
    }

    // set a new timeout to hide the tooltip
    if (hideTooltipTimeoutRef.current !== undefined) {
      clearTimeout(hideTooltipTimeoutRef.current);
    }

    console.log('Tooltip: mouse left - scheduling hide tooltip ');
    hideTooltipTimeoutRef.current = setTimeout(() => {
      console.log('Tooltip: timeout passed - hiding tooltip');
      setTooltipVisible(false);
    }, hideTimeout);
  };

  const showTooltip = (target: HTMLElement) => {
    console.log('Tooltip: showTooltip... canceling hide timeout');
    // set a new timeout to hide the tooltip
    if (hideTooltipTimeoutRef.current !== undefined) {
      clearTimeout(hideTooltipTimeoutRef.current);
      hideTooltipTimeoutRef.current = undefined;
    }

    const content = target.getAttribute(contentAttribute)!;
    const rect = target.getBoundingClientRect();
    const position = {
      top: rect.bottom,
      left: rect.left + rect.width / 2,
    };

    setTooltipVisible(true);
    setTooltipContent(content);
    setTooltipPosition(position);
  };

  useEffect(() => {
    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      
      const trigger = target.getAttribute(triggerAttribute);
      const content = target.getAttribute(contentAttribute);
      if (trigger && content) {
        
        console.log('Tooltip: mouse over - relevant element');
        console.log('content: ' + target.getAttribute('data-tooltip-content'));
        if (!tooltipVisibleRef.current) {
          // we can reset the hide timeout and directly show the new one
          if (showTooltipTimeoutRef.current !== undefined) {
            clearTimeout(showTooltipTimeoutRef.current);
          }
          console.log('Tooltip: mouse over - init sheduling showTooltip');

          showTooltipTimeoutRef.current = setTimeout(() => {
            showTooltip(target);
          }, showTimeout);
        } else {
            console.log('Tooltip: mouse over - open showTooltip');
            
          // set a timeout to show the tooltip
          showTooltip(target);
        }

        console.log('Tooltip: adding mouseleave Listener');
        // prepare hiding of the tooltip:
        target.addEventListener('mouseleave', handleMouseLeave, { once: true });
      } else {
        console.log('Tooltip: mouse over - NOT relevant element');
      }
    };

    console.log('Tooltip: adding mouseOver Listener');
    document.addEventListener('mouseover', handleMouseOver);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  return (
    <OutsideClickHandler
      onOutsideClick={() => { setTooltipVisible(false); }}
      disabled={!tooltipVisible}
    >
      <div className="tooltip--notInteractive" style={{ visibility: tooltipVisible ? 'visible' : 'hidden' }}>
        <div
          className="tooltip--upArrow tooltip--arrowInset tooltip--arrow"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
        />
        <div
          className="tooltip--content"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
          dir="auto"
        >
          <span className="tooltip--text">{tooltipContent}</span>
        </div>
      </div>
    </OutsideClickHandler>
  );
}
