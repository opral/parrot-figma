/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable no-continue */
import React, { ReactNode, useRef, useEffect } from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import './Drawer.css';

type ButtonConfig = {
  text: string,
  callback: Function,
  type: 'primary' | 'primary-destructive' | 'secondary' | 'secondary-destructive',
  key: undefined | 'enter' | 'escape'
  disabled?: boolean
};

type DrawerProps = {
  buttons: ButtonConfig[],
  children: ReactNode,
  shown: boolean,
  position: 'top' | 'left' | 'right'
};

export default function Drawer({
  buttons,
  children,
  shown,
  position = 'top',
}: DrawerProps) {
  const drawerDiv = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        for (const button of buttons) {
          if (button.key === 'escape') {
            button.callback();
            break;
          }
        }
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
    if (shown) {
      const firstInputElement = drawerDiv.current?.querySelector('input');
      if (firstInputElement instanceof HTMLElement) {
        firstInputElement.focus();
      }
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
      }}
      disabled={!shown}
      display="contents"
    >
      <div ref={drawerDiv} className={`${position}-drawer${shown ? ' open' : ' '}`}>
        {children}
        <div className="buttonGroup buttonGroup-reversed">
          {buttons.reverse().map((button) => (
            <button
              className={`button button-${button.type}`}
              type="button"
              onClick={() => {
                button.callback();
              }}
              disabled={button.disabled}
            >
              <span data-tooltip-type="text">
                {button.text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </OutsideClickHandler>
  );
}
