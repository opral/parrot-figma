/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable no-continue */
import React, { ReactNode, useRef, useEffect, useState } from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import './Drawer.css';

type ButtonConfig = {
  text: string;
  callback: Function;
  type: 'primary' | 'primary-destructive' | 'secondary' | 'secondary-destructive';
  key: undefined | 'enter' | 'escape';
  disabled?: boolean;
};

type DrawerProps = {
  className?: string;
  buttons: ButtonConfig[];
  beforeShow?: () => Promise<void> | undefined;
  onCancel?: () => void;
  children: ReactNode;
  shown: boolean;
  position: 'top' | 'left' | 'right';
};

export default function Drawer({
  buttons,
  className,
  children,
  shown,
  onCancel,
  beforeShow,
  position = 'top',
}: DrawerProps) {
  const drawerDiv = useRef<HTMLDivElement | null>(null);
  const showPromise = useRef<Promise<void> | undefined>(undefined);

  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        for (const button of buttons) {
          if (button.key === 'escape') {
            button.callback();
            break;
          }
        }
        onCancel?.();
      } else if (event.key === 'Enter') {
        for (const button of buttons) {
          if (button.key === 'enter') {
            button.callback();
            break;
          }
        }
      }
    };

    const divElement = drawerDiv.current;
    if (divElement) {
      divElement.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (divElement) {
        divElement.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [buttons]);

  useEffect(() => {
    if (isShown) {
      const firstInputElement = drawerDiv.current?.querySelector('input');
      if (firstInputElement instanceof HTMLElement) {
        firstInputElement.focus();
      }
    }
  }, [isShown]);

  useEffect(() => {
    if (shown) {
      if (beforeShow !== undefined) {
        showPromise.current = beforeShow();
        showPromise.current!.then(() => {
          setIsShown(true);
        });
      } else {
        setIsShown(true);
      }
    } else {
      setIsShown(false);
      showPromise.current = undefined;
    }
  }, [shown]);

  return (
    <OutsideClickHandler
      onOutsideClick={() => {
        for (const button of buttons) {
          if (button.key === 'escape') {
            button.callback();
            break;
          }
        }
        onCancel?.();
      }}
      disabled={!isShown}
      display="contents"
    >
      <div
        ref={drawerDiv}
        className={`${position}-drawer${isShown ? ' open' : ' '} ${className ?? ''}`}
      >
        {children}
        <div className="buttonGroup buttonGroup-reversed">
          {buttons.reverse().map((button, index) => (
            <button
              // eslint-disable-next-line react/no-array-index-key -- buttons should not be updated dynamically here
              key={index}
              className={`button button-${button.type}`}
              type="button"
              onClick={() => {
                button.callback();
              }}
              disabled={button.disabled}
            >
              <span data-tooltip-type="text">{button.text}</span>
            </button>
          ))}
        </div>
      </div>
    </OutsideClickHandler>
  );
}
