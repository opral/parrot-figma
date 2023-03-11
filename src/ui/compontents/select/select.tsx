/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, {
  useEffect, useState, useRef,
} from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import './select.css';

export interface SelectOption {
  divider?: string | boolean;
  value: string | number | boolean;
  label: string;
  icon?: string;
  title?: string;
}

export interface SelectProps {
  className?: string;
  options: SelectOption[];
  placeholder: string;
  isDisabled?: boolean;
  defaultValue?: string | number | boolean;
  onExpand?: (state: boolean) => void;
  onChange?: (option: SelectOption) => void;
}

export default function Select({
  className = '',
  options,
  placeholder,
  isDisabled,
  defaultValue,
  onExpand,
  onChange,
}: SelectProps) {
  const menuRef = useRef<HTMLUListElement>(null);
  const menuWrapperRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const scrollUpRef = useRef<HTMLDivElement>(null);
  const scrollDownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [isExpanded, onExpandedStateChange] = useState(false);
  const [selectedOption, onSelectOption] = useState(
    options.find(({ value }) => defaultValue === value),
  );

  const [wrapperMaxHeight, setWrapperMaxHeigth] = useState(30);
  const [containerBox, setContainerBox] = useState({
    top: 30,
    height: 30,
  });
  const [wrapperScrollTop, setWrapperScrollTop] = useState({ scrollTop: 30 });
  const [viewPortHeight, setViewPortHeight] = useState(0);

  const menuPositionIndex = options.findIndex((selectOption) => selectedOption !== undefined && selectOption.value === selectedOption?.value);

  let initialPositioning = false;

  // synchronize visibile height
  useEffect(() => {
    const threshol = [];
    for (let i = 0; i <= 1.0; i += 0.01) {
      threshol.push(i);
    }

    const intersectionObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
      setViewPortHeight(entries[0].intersectionRect.height);
    }, {
      root: null, // default is the viewport
      threshold: threshol, // percentage of target's visible area. Triggers "onIntersection"
    });

    const resizeObserver = new ResizeObserver(() => {
      // reobserve the intersection to get the correct sizing
      intersectionObserver.disconnect();
      intersectionObserver.observe(window.document.body);
    });

    if (window) {
      intersectionObserver.observe(window.document.body);
      resizeObserver.observe(window.document.body, { box: 'border-box' });
    }

    return () => {
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (onExpand !== undefined) {
      onExpand(isExpanded);
    }

    if (isExpanded && menuWrapperRef.current !== undefined) {
      // on expand calculate starting position
      const rect = buttonRef.current!.getBoundingClientRect();
      menuWrapperRef.current!.style.left = `${rect.left}px`;

      const menuPadding = 8;
      const menuEntryHeight = 24;
      const maxSpaceToTop = rect.top;
      const maxSpaceToBottom = viewPortHeight - rect.top - menuEntryHeight;

      const selectedDiv = menuWrapperRef.current!.childNodes[0].childNodes[menuPositionIndex] as HTMLDivElement;

      const spaceNeededOnTop = selectedDiv ? selectedDiv?.offsetTop : 0;

      const spaceNeededOnBottom = (options.length - menuPositionIndex - 1) * menuEntryHeight + menuPadding;

      const height = Math.min(maxSpaceToTop, spaceNeededOnTop) + menuEntryHeight + Math.min(maxSpaceToBottom, spaceNeededOnBottom);
      const top = Math.max(0, maxSpaceToTop - spaceNeededOnTop);

      const scroll = Math.max(0, spaceNeededOnTop - maxSpaceToTop);

      setContainerBox({
        top,
        height,
      });

      setWrapperMaxHeigth(maxSpaceToTop + menuEntryHeight + maxSpaceToBottom);
      setWrapperScrollTop({ scrollTop: scroll });
    }
  }, [isExpanded, viewPortHeight, menuWrapperRef]);

  useEffect(() => {
    if (menuWrapperRef.current !== undefined) {
      initialPositioning = true;

      menuWrapperRef.current!.scrollTop = wrapperScrollTop.scrollTop;

      if (menuWrapperRef.current!.scrollTop === (menuWrapperRef.current!.scrollHeight - menuWrapperRef.current!.offsetHeight)
          || menuRef.current?.clientHeight === menuWrapperRef.current?.clientHeight) {
        // at bottom
        setCanScrollDown(false);
      } else {
        setCanScrollDown(true);
      }

      if (menuWrapperRef.current!.scrollTop === 0) {
        // at top
        setCanScrollUp(false);
      } else {
        setCanScrollUp(true);
      }
    }
  }, [wrapperScrollTop]);

  useEffect(() => {
    if (menuWrapperRef.current !== undefined) {
      if (menuWrapperRef.current!.scrollTop === (menuWrapperRef.current!.scrollHeight - menuWrapperRef.current!.offsetHeight)
          || menuRef.current?.clientHeight === menuWrapperRef.current?.clientHeight) {
        // at bottom
        setCanScrollDown(false);
      } else {
        setCanScrollDown(true);
      }

      if (menuWrapperRef.current!.scrollTop === 0) {
        // at top
        setCanScrollUp(false);
      } else {
        setCanScrollUp(true);
      }
    }
  }, [containerBox]);

  useEffect(() => {
    if (onChange && selectedOption) {
      onSelectOption(selectedOption);
    }
  }, [selectedOption]);

  useEffect(() => {
    const newSelectedOption = options.find(
      ({ value }) => defaultValue === value,
    );
    onSelectOption(newSelectedOption);
  }, [defaultValue]);

  let lastScrollPos = 0;

  useEffect(() => {
    const scrollHandler = () => {
      if (initialPositioning) {
        initialPositioning = false;
        return;
      }

      const diff = menuWrapperRef.current!.scrollTop - lastScrollPos;
      // menuWrapperRef.current!.scrollTop = lastScrollPos;
      lastScrollPos = menuWrapperRef.current!.scrollTop;

      if (menuWrapperRef.current!.scrollTop === (menuWrapperRef.current!.scrollHeight - menuWrapperRef.current!.offsetHeight)
          || menuRef.current?.clientHeight === menuWrapperRef.current?.clientHeight) {
        // at bottom
        setCanScrollDown(false);
      } else {
        setCanScrollDown(true);
      }

      if (menuWrapperRef.current!.scrollTop === 0) {
        // at top
        setCanScrollUp(false);
      } else {
        setCanScrollUp(true);
      }

      if (diff < 0) {
        setContainerBox((box) => {
          if (box.height - diff > wrapperMaxHeight) {
            return {
              height: wrapperMaxHeight,
              top: box.top,
            };
          }
          // scroll up - grow by setting height and reposition to top
          return {
            height: box.height - diff,
            top: box.top,
          };
        });
      } else {
        setContainerBox((box) => {
          if (box.height + diff > wrapperMaxHeight) {
            return {
              height: wrapperMaxHeight,
              top: box.top,
            };
          }

          // scroll down - only grow by setting height
          return {
            height: box.height + diff,
            top: box.top - diff,
          };
        });
      }
    };

    if (menuWrapperRef.current) {
      lastScrollPos = menuWrapperRef.current!.scrollTop;
      menuWrapperRef.current.addEventListener('scroll', scrollHandler);
    }

    return () => { menuWrapperRef.current?.removeEventListener('scroll', scrollHandler); };
  });

  useEffect(() => {
    // Handler to call on window resize
    function handleResize() {
      onExpandedStateChange(false);
    }
    // Add event listener
    window.addEventListener('resize', handleResize);
    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Empty array ensures that effect is only run on mount

  useEffect(() => {
    let timeInterval = undefined as any;

    const startScrollUp = () => {
      timeInterval = setInterval(() => {
        menuWrapperRef.current!.scrollTop = menuWrapperRef.current!.scrollTop - 4;
      }, 20);
    };

    const stopScrollUp = () => {
      clearInterval(timeInterval);
    };

    if (scrollUpRef.current !== undefined) {
      scrollUpRef.current?.addEventListener('mouseover', startScrollUp);
      scrollUpRef.current?.addEventListener('mouseout', stopScrollUp);
    }

    return () => {
      scrollUpRef.current?.removeEventListener('mouseover', startScrollUp);
      scrollUpRef.current?.removeEventListener('mouseout', stopScrollUp);
    };
  }, [scrollUpRef]);

  useEffect(() => {
    let timeInterval = undefined as any;

    const startScrollDown = () => {
      timeInterval = setInterval(() => {
        menuWrapperRef.current!.scrollTop = menuWrapperRef.current!.scrollTop + 4;
      }, 20);
    };

    const stopScrollDown = () => {
      clearInterval(timeInterval);
    };

    if (scrollDownRef.current !== undefined) {
      scrollDownRef.current?.addEventListener('mouseover', startScrollDown);
      scrollDownRef.current?.addEventListener('mouseout', stopScrollDown);
    }

    return () => {
      scrollDownRef.current?.removeEventListener('mouseover', startScrollDown);
      scrollDownRef.current?.removeEventListener('mouseout', stopScrollDown);
    };
  }, [scrollDownRef]);

  const handleExpandClick = () => {
    onExpandedStateChange(!isExpanded);
  };

  const handleOutsideClick = () => {
    onExpandedStateChange(false);
  };

  const handleSelectClick = (value: any) => {
    const newOption = options.find(({ value: v }) => v === value);
    onExpandedStateChange(false);
    onSelectOption(newOption);

    if (onChange) {
      onChange(newOption!);
    }
  };

  const expandButtonClass = isExpanded ? 'select-menu__button--active' : '';
  const expanListClass = isExpanded ? 'select-menu__menu--active' : '';
  const disabledColorClass = isDisabled ? 'icon--black-3' : '';

  return (
    <OutsideClickHandler
      onOutsideClick={handleOutsideClick}
      disabled={!isExpanded}
    >
      <div className={`select-menu ${className}`}>
        <button
          ref={buttonRef}
          className={`select-menu__button ${expandButtonClass} ${disabledColorClass}`}
          onClick={handleExpandClick}
          disabled={isDisabled}
          title={selectedOption?.title}
          type="button"
        >
          <span className="select-menu__label">
            {(selectedOption && selectedOption.label) || placeholder}
          </span>
          <span className="select-menu__caret" />
        </button>
        <div
          ref={menuContainerRef}
          className="select-menu__menu_container"
          style={
            {
              height: `${containerBox.height}px`,
              top: `${containerBox.top}px`,
            }
}
        >
          <div
            ref={scrollUpRef}
            className="select-menu__menu-scroll-up"
            style={{
              visibility: canScrollUp ? 'visible' : 'hidden',
            }}
          >
            <div className="svg-container arrow-up-svg" />
          </div>
          <div
            ref={scrollDownRef}
            className="select-menu__menu-scroll-down"
            style={{
              visibility: canScrollDown ? 'visible' : 'hidden',
            }}
          >
            <div className="svg-container arrow-down-svg" />
          </div>
          <div ref={menuWrapperRef} className="select-menu__menu_wrapper">
            <ul
              ref={menuRef}
              className={`select-menu__menu ${expanListClass} ${disabledColorClass}`}

            >
              {options
                && options.map(({
                  value, label, divider, title, icon,
                }, i) => (divider ? (
                  // eslint-disable-next-line react/no-array-index-key  -- options are static and dont change - using the index is fine here
                  <React.Fragment key={`select-option-divider--${i}`}>
                    {divider !== true && (
                    <span className="select-menu__divider-label">
                      {divider}
                    </span>
                    )}
                    <div
                      className="select-menu__divider"
                    />
                  </React.Fragment>
                ) : (
                  <li
                    className={`select-menu__item ${
                      selectedOption && selectedOption.value === value
                        ? 'select-menu__item--selected'
                        : ''
                    }`}
                    // eslint-disable-next-line react/no-array-index-key  -- options are static and dont change - using the index is fine here
                    key={`select-option--${i}`}
                    title={title}
                  >
                    <div onMouseUp={() => handleSelectClick(value)}>
                      <div className="select-menu__item-check">
                        { selectedOption && selectedOption.value === value && (
                          <div className="svg-container checkmark-svg" />
                        )}
                      </div>
                      <div className="select-menu__item-icon">
                        <div className={`svg-container ${icon}`} />
                      </div>
                      <span className="select-menu__item-label">{label}</span>
                    </div>
                  </li>
                )))}
            </ul>
          </div>
        </div>
      </div>
    </OutsideClickHandler>
  );
}
