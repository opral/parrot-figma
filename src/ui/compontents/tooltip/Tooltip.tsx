import React, { useState, useEffect, useRef } from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import './Tooltip.css';

interface TooltipProps {
  triggerAttribute: string;
  contentAttribute: string;
}

export default function Tooltip({ triggerAttribute, contentAttribute }: TooltipProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPlacement, setTooltipPlacement] = useState<any | { top: number, left: number, position: string }>({ top: 0, left: 0, position: 'none' });
  const [tooltipSourceRect, setTooltipSourceRect] = useState<DOMRect | undefined>(undefined);
  const tooltipContentEl = useRef<HTMLDivElement | null>(null);

  const tooltipVisibleRef = useRef(tooltipVisible);
  tooltipVisibleRef.current = tooltipVisible;
  const [tooltipContent, setTooltipContent] = useState('');
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
    hideTooltipTimeoutRef.current = setTimeout(() => {
      setTooltipVisible(false);
    }, hideTimeout);
  };

  const showTooltip = (target: HTMLElement) => {
    // set a new timeout to hide the tooltip
    if (hideTooltipTimeoutRef.current !== undefined) {
      clearTimeout(hideTooltipTimeoutRef.current);
      hideTooltipTimeoutRef.current = undefined;
    }

    const content = target.getAttribute(contentAttribute)!;
    setTooltipSourceRect(target.getBoundingClientRect());
    setTooltipVisible(true);
    setTooltipContent(content);
    setTooltipPlacement(undefined);
  };

  useEffect(() => {
    console.log(`handling placement; ${tooltipPlacement}`);
    if (tooltipPlacement !== undefined) {
      return;
    }

    // calculate the box and try to fit it below.
    // - try center, try left or use right
    // else place on top
    // - try center, try left or use right

    const element = tooltipContentEl.current;
    if (element === null || tooltipSourceRect === undefined) {
      return;
    }

    const elementRect = element.getBoundingClientRect();
    const height = elementRect.height + 8;

    const parent = document.getElementById('react-page')!;
    const parentRect = parent.getBoundingClientRect();

    if (parentRect.bottom - tooltipSourceRect.bottom > height) {
      // great if fits below
      const placement = {
        top: tooltipSourceRect.bottom,
        left: tooltipSourceRect.left + tooltipSourceRect.width / 2,
        position: 'bottom-center',
      };

      setTooltipPlacement(placement);
    } else {
      // ok we have to put it on top
      const placement = {
        top: tooltipSourceRect.top - height,
        left: tooltipSourceRect.left + tooltipSourceRect.width / 2,
        position: 'top-center',
      };
      setTooltipPlacement(placement);
    }

    console.log('is fully visible?');
    console.log(elementRect.top, parentRect.top);
    console.log(elementRect.bottom, parentRect.bottom);
    console.log(elementRect.left, parentRect.left);
    console.log(
      elementRect.top >= parentRect.top
    && elementRect.bottom <= parentRect.bottom
    && elementRect.left >= parentRect.left
    && elementRect.right <= parentRect.right,
    );
  }, [tooltipPlacement]);

  useEffect(() => {
    const handleMouseOver = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      const target = event.target as HTMLElement;

      let tooltipSource : HTMLElement | undefined;
      let currentEl = target as HTMLElement | null;

      while (currentEl) {
        if (currentEl.matches('[data-tooltip-content]')) {
          tooltipSource = currentEl;
          break;
        }

        currentEl = currentEl.parentElement;
      }

      if (tooltipSource === undefined) {
        return;
      }

      const trigger = tooltipSource.getAttribute(triggerAttribute);
      const content = tooltipSource.getAttribute(contentAttribute);
      if (trigger && content) {
        if (!tooltipVisibleRef.current) {
          // we can reset the hide timeout and directly show the new one
          if (showTooltipTimeoutRef.current !== undefined) {
            clearTimeout(showTooltipTimeoutRef.current);
          }
          showTooltipTimeoutRef.current = setTimeout(() => {
            showTooltip(tooltipSource!);
          }, showTimeout);
        } else {
          // set a timeout to show the tooltip
          showTooltip(tooltipSource);
        }

        // prepare hiding of the tooltip:
        tooltipSource.addEventListener('mouseleave', handleMouseLeave, { once: true });

        event.stopPropagation();
      }
    };

    document.addEventListener('mouseover', handleMouseOver);

    function onScroll() {
      setTooltipVisible(false);
    }

    document.addEventListener('wheel', onScroll);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('wheel', onScroll);
    };
  }, []);

  let arrowDirection = 'up';
  if (tooltipPlacement && tooltipPlacement.position.indexOf('top') !== -1) {
    arrowDirection = 'down';
  }

  return (
    <OutsideClickHandler
      onOutsideClick={() => { setTooltipVisible(false); }}
      disabled={!tooltipVisible}
    >
      <div className="tooltip--notInteractive" style={{ visibility: tooltipVisible && tooltipPlacement ? 'visible' : 'hidden' }}>
        <div
          className={`tooltip--${arrowDirection}Arrow tooltip--arrowInset tooltip--arrow`}
          style={{
            top: tooltipPlacement?.top ?? 0,
            left: tooltipPlacement?.left ?? 0,
          }}
        />
        <div
          ref={tooltipContentEl}
          className={`tooltip--content tooltip--content-${arrowDirection}`}
          style={{
            top: tooltipPlacement?.top ?? 0,
            left: tooltipPlacement?.left ?? 0,
          }}
          dir="auto"
        >
          <span className="tooltip--text">{tooltipContent}</span>
        </div>
      </div>
    </OutsideClickHandler>
  );
}
