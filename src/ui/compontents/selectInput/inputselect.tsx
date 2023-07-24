/* eslint-disable jsx-a11y/mouse-events-have-key-events */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, {
  useEffect, useState, useRef, MouseEvent,
} from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import './inputselect.css';
import { debug } from 'console';
import { Plural } from '../../../lib/base/Plural';
import { Language } from '../../../lib/base/Language';

export enum InputSelectionOptionType {
  SUGGESTION,
  ADD,
  ACTION,
  DIVIDER,
}

export interface InputSelectOption {
  divider?: string | boolean;
  value: string;
  plural?: Plural,
  language?: Language,
  type: InputSelectionOptionType;
  label: string;
  icon?: string;
  title?: string;
}

export interface InputSelectProps {
  className?: string;
  iconClass?: string,
  tooltip?: string,
  getOptions: (inputValue: string) => InputSelectOption[];
  placeholder: string;
  inputPlaceholder: string;
  isDisabled?: boolean;
  defaultValue?: string;
  onExpand?: (state: boolean) => void;
  onChange?: (option: InputSelectOption) => void;
  onCancel?: () => void;
  valueReplaceFn?: (value: string) => string,
}

function positiveModulo(a: number, b: number) {
  return ((a % b) + b) % b;
}

export default function InputSelect({
  className = '',
  iconClass,
  getOptions,
  tooltip,
  placeholder,
  inputPlaceholder,
  isDisabled,
  defaultValue,
  onExpand,
  onChange,
  onCancel,
  valueReplaceFn,
}: InputSelectProps) {
  const menuRef = useRef<HTMLUListElement>(null);
  const menuWrapperRef = useRef<HTMLDivElement>(null);
  const menuOverlayRef = useRef<HTMLDivElement>(null);
  const menuScrollContainerRef = useRef<HTMLDivElement>(null);
  const inputFieldRef = useRef<HTMLInputElement>(null);
  const scrollUpRef = useRef<HTMLDivElement>(null);
  const scrollDownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [isExpanded, onExpandedStateChange] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [suggestion, setSuggestion] = useState<string | undefined>(undefined);
  const currentHighlightIndex = useRef<number | undefined>(undefined);
  const currentMouseOverHighlightIndex = useRef<number | undefined>(undefined);
  // Dummy state variable to trigger re-render when currentHighlightIndex.current changes
  const [highlightUpdated, setDummyState] = useState<any>();

  const [options, setOptions] = useState<InputSelectOption[]>([] as InputSelectOption[]);

  const wrapperMaxHeight = useRef(30);
  const wrapperMaxHeightTop = useRef(30);
  const wrapperMaxHeightBottom = useRef(30);
  const wrapperMenuEntryHeight = useRef(30);
  const lastScrollPos = useRef(0);

  const [viewPortHeight, setViewPortHeight] = useState(0);

  const startScrollDownTimeInterval = useRef<any>(-1);
  const startScrollUpTimeInterval = useRef<any>(-1);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const highlightedEls = menuRef.current?.getElementsByClassName('input-select-menu__item--highlighted');
    if (currentMouseOverHighlightIndex.current === undefined && highlightedEls && highlightedEls?.length > 0) {
      // console.log('scolling into view:');
      const rectToMakeVisible = highlightedEls[0].getBoundingClientRect();
      const visibleRect = menuWrapperRef.current!.getBoundingClientRect();
      const visibleBottom = visibleRect.bottom - scrollDownRef.current!.clientHeight;
      const visibleTop = visibleRect.top + scrollDownRef.current!.clientHeight;
      if (rectToMakeVisible.bottom > visibleBottom) {
        menuWrapperRef.current!.scrollTop = menuWrapperRef.current!.scrollTop + (rectToMakeVisible.bottom - visibleBottom);
      }
      if (rectToMakeVisible.top < visibleTop) {
        menuWrapperRef.current!.scrollTop = menuWrapperRef.current!.scrollTop - (visibleTop - rectToMakeVisible.top);
      }

      // highlightedEls[0].scrollIntoViewIfNeeded();
    }
  }, [highlightUpdated]);

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

  const updateCurrentMouseOverHighlightIndex = (newIndex: number | undefined) => {
    currentMouseOverHighlightIndex.current = newIndex;
    setDummyState({}); // Trigger re-render by updating dummy state
  };

  const updateCurrentHighlightIndex = (newIndex: number | undefined) => {
    currentHighlightIndex.current = newIndex;
    updateCurrentMouseOverHighlightIndex(undefined);
    setDummyState({}); // Trigger re-render by updating dummy state
  };
  const handleExpandClick = () => {
    onExpandedStateChange(!isExpanded);
  };

  const handleOutsideClick = () => {
    onExpandedStateChange(false);
    setValue(defaultValue);
    onCancel?.();
  };

  const selectHighlight = () => {
    const i = currentMouseOverHighlightIndex.current ?? currentHighlightIndex.current;
    if (i === undefined) {
      if (value === '') {
        onExpandedStateChange(false);
        onChange?.({
          type: InputSelectionOptionType.ACTION,
          value: 'reset',
          label: '',
        });
      }
      return;
    }

    const newOption = options[i];
    onExpandedStateChange(false);
    if (onChange) {
      onChange(newOption!);
    }
  };

  const highlightMouseOverIndex = (i: number | undefined) => {
    if (i === undefined || options[i].type !== InputSelectionOptionType.DIVIDER) {
      updateCurrentMouseOverHighlightIndex(i);
    }
  };

  const resetHighlight = () => {
    updateCurrentHighlightIndex(undefined);
    updateCurrentMouseOverHighlightIndex(undefined);

    let i = 0;
    for (const option of options) {
      if ((option.type === InputSelectionOptionType.ADD
      || option.type === InputSelectionOptionType.SUGGESTION) && option.value === value) {
        updateCurrentHighlightIndex(i);
      }
      i += 1;
    }
  };

  const hightlightNext = () => {
    if (currentMouseOverHighlightIndex.current) {
      currentHighlightIndex.current = currentMouseOverHighlightIndex.current;
    }
    if (currentHighlightIndex.current === undefined) {
      // start a new selection from the top of the list
      currentHighlightIndex.current = -1;
    }

    do {
      updateCurrentHighlightIndex(positiveModulo!(currentHighlightIndex.current! + 1, options.length));
    } while (options[currentHighlightIndex.current!].type === InputSelectionOptionType.DIVIDER);
  };

  const hightlightPrevious = () => {
    if (currentMouseOverHighlightIndex.current) {
      currentHighlightIndex.current = currentMouseOverHighlightIndex.current;
    }
    if (currentHighlightIndex.current === undefined) {
      // start a new selection from the bottom of the list
      updateCurrentHighlightIndex(options.length);
    }
    do {
      updateCurrentHighlightIndex(positiveModulo(currentHighlightIndex.current! - 1, options.length));
    } while (options[currentHighlightIndex.current!].type === InputSelectionOptionType.DIVIDER);
  };

  const continueWithHighlight = () => {
    if (currentMouseOverHighlightIndex.current !== undefined) {
      if (options[currentMouseOverHighlightIndex.current].value === value) {
        return false;
      }
      setValue(options[currentMouseOverHighlightIndex.current].value);
      return true;
    }

    if (currentHighlightIndex.current !== undefined) {
      if (options[currentHighlightIndex.current].value === value) {
        return false;
      }
      setValue(options[currentHighlightIndex.current].value);
      return true;
    }

    return false;
  };

  useEffect(() => {
    const mouseHighlight = currentMouseOverHighlightIndex.current !== undefined && options[currentMouseOverHighlightIndex.current]?.type === InputSelectionOptionType.SUGGESTION ? options[currentMouseOverHighlightIndex.current]?.value : undefined;
    if (mouseHighlight) {
      setSuggestion(mouseHighlight);
    } else {
      setSuggestion(currentHighlightIndex.current && options[currentHighlightIndex.current]?.type === InputSelectionOptionType.SUGGESTION ? options[currentHighlightIndex.current]?.value : undefined);
    }
  }, [currentHighlightIndex.current, currentMouseOverHighlightIndex.current]);

  useEffect(() => {
    if (onExpand !== undefined) {
      onExpand(isExpanded);
    }

    if (isExpanded) {
      setOptions(getOptions(value ?? ''));
    }
  }, [isExpanded, value]);

  useEffect(() => {
    if (isExpanded && inputFieldRef.current !== document.activeElement) {
      inputFieldRef.current?.focus();
      inputFieldRef.current?.select();
    }
  }, [isExpanded, value]);

  function updateScrollButtons() {
    const menuRect = menuWrapperRef.current!.getBoundingClientRect();
    if (
      (menuWrapperRef.current!.scrollTop - (menuWrapperRef.current!.scrollHeight - menuRect.height) > -1)
    || menuRef.current!.clientHeight === menuWrapperRef.current?.clientHeight) {
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

  useEffect(() => {
    if (isExpanded && menuWrapperRef.current !== undefined) {
      // on expand calculate starting position
      const rect = buttonRef.current!.getBoundingClientRect();
      // menuWrapperRef.current!.style.left = `${rect.left}px`;

      const menuPadding = 8;
      const menuMargin = 8;
      const menuEntryHeight = 24;
      const maxSpaceToTop = rect.top;
      const maxSpaceToBottom = viewPortHeight - rect.bottom - menuMargin;

      const minimumItemsVisible = 3;

      const showBelow = maxSpaceToBottom > (menuEntryHeight + menuPadding) * minimumItemsVisible;

      const spaceNeeded = menuRef.current!.scrollHeight;

      const height = showBelow ? Math.min(maxSpaceToBottom, spaceNeeded) : Math.min(maxSpaceToTop, spaceNeeded);

      const top = showBelow ? maxSpaceToTop + menuEntryHeight : 0;
      /*
      if (top < 0) {
        height = maxSpaceToTop + menuEntryHeight + Math.min(maxSpaceToBottom, spaceNeededOnBottom);
        top = 0;
      } */

      const scrollTop = 0; // spaceNeededOnTop - maxSpaceToTop;

      menuScrollContainerRef.current!.style.height = `${height}px`;
      if (showBelow) {
        menuOverlayRef.current!.style.flexDirection = 'column';
        menuOverlayRef.current!.style.top = `${rect.top}px`;
        menuOverlayRef.current!.style.bottom = 'unset';
      } else {
        menuOverlayRef.current!.style.top = 'unset';
        menuOverlayRef.current!.style.bottom = `${viewPortHeight - rect.bottom}px`;
        menuOverlayRef.current!.style.flexDirection = 'column-reverse';
      }

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const isOverlappingRight = menuOverlayRef.current!.getBoundingClientRect().right > viewportWidth;
      if (isOverlappingRight) {
        menuOverlayRef.current!.style.right = `${3}px`;
      }

      //

      wrapperMaxHeight.current = maxSpaceToTop + menuEntryHeight + maxSpaceToBottom;
      wrapperMaxHeightBottom.current = maxSpaceToBottom;
      wrapperMaxHeightTop.current = maxSpaceToTop;
      wrapperMenuEntryHeight.current = menuEntryHeight;
      menuWrapperRef.current!.scrollTop = scrollTop;

      // menuWrapperRef.current!.scrollTop = menuWrapperRef.current!.scrollTop;

      updateScrollButtons();
    }

    const scrollHandler = (evt: any) => {
      if (evt.target !== scrollDownRef.current
        && !scrollDownRef.current?.contains(evt.target)
        && evt.target !== scrollUpRef.current
        && !scrollUpRef.current?.contains(evt.target)) {
        updateScrollButtons();
      }
    };

    if (menuWrapperRef.current) {
      lastScrollPos.current = menuWrapperRef.current!.scrollTop;
      menuWrapperRef.current.addEventListener('scroll', scrollHandler);
    }

    return () => { menuWrapperRef.current?.removeEventListener('scroll', scrollHandler); };
  }, [options, isExpanded, viewPortHeight, menuWrapperRef]);

  useEffect(() => {
    resetHighlight();
  }, [options]);

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
    const startScrollUp = () => {
      if (startScrollUpTimeInterval.current === -1) {
        startScrollUpTimeInterval.current = setInterval(() => {
          menuWrapperRef.current!.scrollTop = menuWrapperRef.current!.scrollTop - 4;
        }, 20);
      }
    };

    const stopScrollUp = () => {
      clearInterval(startScrollUpTimeInterval.current);
      startScrollUpTimeInterval.current = -1;
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
    const startScrollDown = () => {
      if (startScrollDownTimeInterval.current === -1) {
        startScrollDownTimeInterval.current = setInterval(() => {
          menuWrapperRef.current!.scrollTop = menuWrapperRef.current!.scrollTop + 4;
        }, 20);
      }
    };

    const stopScrollDown = () => {
      clearInterval(startScrollDownTimeInterval.current);
      startScrollDownTimeInterval.current = -1;
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

  const expandButtonClass = isExpanded ? 'input-select-menu__button--active' : '';
  const expanListClass = isExpanded ? 'input-select-menu__menu--active' : '';
  const disabledColorClass = isDisabled ? 'icon--black-3' : '';

  const label = value || placeholder;
  const labelParts = label.split('_');

  let labelPart1 = labelParts[0];
  let labelPart2 = '';

  if (labelParts.length > 1) {
    labelPart2 = `_${labelParts.pop()}`;
    labelPart1 = labelParts.join('_');
  }

  const addOptionIndex = options.findIndex((option) => option.type === InputSelectionOptionType.ADD);

  const addActive = ((currentMouseOverHighlightIndex.current === undefined && currentHighlightIndex.current === addOptionIndex) || (currentMouseOverHighlightIndex.current !== undefined && currentMouseOverHighlightIndex.current === addOptionIndex));

  let suggestionFieldValue = inputPlaceholder;
  if (suggestion !== undefined) {
    suggestionFieldValue = suggestion;
  } else if (value !== undefined && value !== '') {
    suggestionFieldValue = value;
  }

  return (
    <OutsideClickHandler
      display="contents"
      onOutsideClick={handleOutsideClick}
      disabled={!isExpanded}
    >
      <div className={`input-select-menu ${className}`}
      data-tooltip-trigger="div"
      data-tooltip-content={tooltip}
      >
        <button
          ref={buttonRef}
          className={`input-select-menu__button ${expandButtonClass} ${disabledColorClass} ${value ? '' : 'placeholder'}`}
          onClick={handleExpandClick}
          disabled={isDisabled}
          title={value}
          type="button"
        >
          {iconClass !== undefined && (
            <div className={`svg-container ${iconClass}`} style={{ marginRight: '8px' }} />
          )}
          <span className="input-select-menu__label input-select-menu__label-part1">
            {labelPart1}
          </span>
          <span className="input-select-menu__label input-select-menu__label-part2">
            {labelPart2}
          </span>
          <span className="input-select-menu__caret svg-container caret-svg" />
        </button>
        <div ref={menuOverlayRef} className={`input-select-editoverlay ${expanListClass} ${disabledColorClass}`}>

          <div className={`input-select-menu__input ${expanListClass} `}>
            <p
              className="suggestion"
            >
              { suggestionFieldValue }
            </p>
            { addOptionIndex !== -1 && (
            // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
            <div
              tabIndex={addOptionIndex}
              className={`input-select-menu-add  ${addActive ? 'on-primary' : ''}`}
              onMouseOver={() => highlightMouseOverIndex(addOptionIndex)}
              onMouseLeave={() => highlightMouseOverIndex(undefined)}
              onMouseUp={() => selectHighlight()}

            >
              <div
                className="svg-container plus-svg"
              />
            </div>
            )}
            <input
              ref={inputFieldRef}
              className={` ${addOptionIndex !== -1 ? 'addVisible' : ''}`}
              value={value}
              onChange={(evt: React.ChangeEvent<HTMLInputElement>) => {
                const val = valueReplaceFn ? valueReplaceFn(evt.target?.value) : evt.target?.value;
                setValue(val);
              }}
              onBlur={(evt) => {
                if (!evt.relatedTarget?.classList.contains('input-select-menu__item') && !evt.relatedTarget?.classList.contains('input-select-menu-add')) {
                  onExpandedStateChange(false);
                  setValue(defaultValue);
                  onCancel?.();
                }
              }}
              onKeyDown={(evt: React.KeyboardEvent<HTMLInputElement>) => {
              // Get the name of the pressed key
                const keyName = evt.key;

                switch (keyName) {
                  case 'ArrowDown':
                    hightlightNext();
                    evt.preventDefault();
                    break;
                  case 'ArrowUp':
                    hightlightPrevious();
                    evt.preventDefault();
                    break;
                  case 'ArrowRight':
                    if (continueWithHighlight()) {
                      evt.preventDefault();
                    }
                    break;
                  case 'Tab':
                    selectHighlight();
                    break;
                  case 'Enter':
                    selectHighlight();
                    break;
                  case 'Escape':
                    onExpandedStateChange(false);
                    setValue(defaultValue);
                    onCancel?.();
                    break;

                  default:
                    console.log(keyName);
                    resetHighlight();
                    // TODO check in on change illigal characters in keys and remove them
                    break;
                }
              }}
            />
          </div>
          <div
            ref={menuScrollContainerRef}
            className="input-select-menu__menu_container"
          >
            <div
              ref={scrollUpRef}
              className="input-select-menu__menu-scroll-up"
              style={{
                visibility: canScrollUp ? 'visible' : 'hidden',
              }}
            >
              <div className="svg-container arrow-up-svg" />
            </div>
            <div
              ref={scrollDownRef}
              className="input-select-menu__menu-scroll-down"
              style={{
                visibility: canScrollDown ? 'visible' : 'hidden',
              }}
            >
              <div className="svg-container arrow-down-svg" />
            </div>

            <div
              ref={menuWrapperRef}
              className="input-select-menu__menu_wrapper"
              onMouseOut={(evt: MouseEvent<HTMLDivElement>) => {
                if (!menuWrapperRef.current?.contains(evt?.currentTarget)) {
                  highlightMouseOverIndex(undefined);
                }
              }}
            >

              <ul
                ref={menuRef}
                className={`input-select-menu__menu ${expanListClass} ${disabledColorClass}`}
              >
                {options?.map(({
                  label: optionLabel, type: optionType, icon,
                }, i) => {
                  if (optionType === InputSelectionOptionType.DIVIDER) {
                    return (
                    // eslint-disable-next-line react/no-array-index-key -- does not change
                      <React.Fragment key={`input-select-option-divider--${i}`}>

                        {i > 0 && options[i - 1].type !== InputSelectionOptionType.ADD && (
                        <div
                          className="input-select-menu__divider"
                        />
                        )}

                        {optionLabel && optionLabel !== '' && (
                        <span className="input-select-menu__divider-label">
                          {optionLabel}
                        </span>
                        )}
                      </React.Fragment>
                    );
                  }
                  if (optionType === InputSelectionOptionType.SUGGESTION || optionType === InputSelectionOptionType.ACTION) {
                    return (
                    // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
                      <li
                        tabIndex={i}
                        className={`input-select-menu__item ${
                          (currentMouseOverHighlightIndex.current === undefined && currentHighlightIndex.current === i)
                        || (currentMouseOverHighlightIndex.current !== undefined && currentMouseOverHighlightIndex.current === i)
                            ? 'input-select-menu__item--highlighted'
                            : ''
                        }`}
                        // eslint-disable-next-line react/no-array-index-key  -- options are static and dont change - using the index is fine here
                        key={`input-select-option--${i}`}
                        onMouseUp={() => {
                          selectHighlight();
                        }}
                        onMouseMove={() => highlightMouseOverIndex(i)}
                      >

                        { icon && (
                        <div className="input-select-menu__item-icon">
                          <div className={`svg-container ${icon}`} />
                        </div>
                        )}
                        <span className="input-select-menu__item-label">{optionLabel}</span>
                      </li>
                    );
                  }
                  return undefined;
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </OutsideClickHandler>
  );
}
