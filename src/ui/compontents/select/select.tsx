import React, { useEffect, useState, useRef, createRef } from "react";
import OutsideClickHandler from "react-outside-click-handler";
import "./select.css"

export interface SelectOption {
  divider?: string | boolean;
  value: string | number | boolean;
  label: string;
  icon?: string;
  title?: string;
}
  
interface SelectProps {
  className?: string;
  options: SelectOption[];
  unSelectedIcon: string; 
  placeholder: string;
  isDisabled?: boolean;
  defaultValue?: string | number | boolean;
  onExpand?: (state: boolean) => void;
  onChange?: (option: SelectOption) => void;
}
  
const Select: React.FunctionComponent<SelectProps> = ({
  className = "",
  unSelectedIcon,
  options,
  placeholder,
  isDisabled,
  defaultValue,
  onExpand,
  onChange,
}) => {

  const menuRef = useRef<HTMLUListElement>(null)
  const menuWrapperRef = useRef<HTMLDivElement>(null)
  const menuContainerRef = useRef<HTMLDivElement>(null)
  const scrollUpRef = useRef<HTMLDivElement>(null)
  const scrollDownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [isExpanded, onExpandedStateChange] = useState(false);
  const [selectedOption, onSelectOption] = useState(
    options.find(({ value }) => defaultValue === value)
  );
  
  const [wrapperMaxHeight, setWrapperMaxHeigth] = useState(30);
  const [containerBox, setContainerBox] = useState({
    top: 30,
    height: 30
  });
  const [wrapperScrollTop, setWrapperScrollTop] = useState({scrollTop: 30});
  const [viewPortHeight, setViewPortHeight] = useState(0);

  let menuPositionIndex = options.findIndex(selectOption => selectedOption != undefined && selectOption.value === selectedOption?.value);

  let initialPositioning = false;

  // synchronize visibile height
  useEffect(() => {
    let threshol = [];
    for (let i=0; i<=1.0; i+= 0.01) {
        threshol.push(i); 
    }

    const observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {    
      console.log('setting hight to:' + entries[0].intersectionRect.height)  
      setViewPortHeight(entries[0].intersectionRect.height);
    }, {
      root: null,   // default is the viewport
      threshold: threshol // percentage of target's visible area. Triggers "onIntersection"
    });

    if (window) {
        observer.observe(window.document.body);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    onExpand && onExpand(isExpanded);
    if(isExpanded) {
      
      // on expand calculate starting position
      var rect = buttonRef.current!.getBoundingClientRect();
      menuWrapperRef.current!.style.left = rect.left + 'px';

      let menuPadding = 8
      let menuEntryHeight = 24;
      let maxSpaceToTop = rect.top; 
      let maxSpaceToBottom = viewPortHeight - rect.top - menuEntryHeight; 

      let selectedDiv = menuWrapperRef.current!.childNodes[0].childNodes[menuPositionIndex] as HTMLDivElement
      
      let spaceNeededOnTop = menuPositionIndex * menuEntryHeight + menuPadding;
      spaceNeededOnTop = selectedDiv?.offsetTop;
      console.log('selectedDiv.offsetTop')
      console.log(menuWrapperRef.current!.childNodes)
      console.log(selectedDiv?.offsetTop)
      console.log(spaceNeededOnTop);
      let spaceNeededOnBottom = (options.length - menuPositionIndex -1) * menuEntryHeight + menuPadding;

      
      const height = Math.min(maxSpaceToTop, spaceNeededOnTop) + menuEntryHeight + Math.min(maxSpaceToBottom, spaceNeededOnBottom);
      const top = Math.max(0, maxSpaceToTop - spaceNeededOnTop);
      
      let scroll = Math.max(0, spaceNeededOnTop - maxSpaceToTop);
      
      console.log('setting top:' + top)
      setContainerBox({
        top: top, 
        height: height
      })
      setWrapperMaxHeigth(maxSpaceToTop + menuEntryHeight + maxSpaceToBottom);
      setWrapperScrollTop({scrollTop: scroll})

    }
  }, [isExpanded, viewPortHeight]);

  useEffect(() => {
    if (menuWrapperRef.current !== undefined) {
      initialPositioning = true;


      menuWrapperRef.current!.scrollTop = wrapperScrollTop.scrollTop;

      if( menuWrapperRef.current!.scrollTop === (menuWrapperRef.current!.scrollHeight - menuWrapperRef.current!.offsetHeight) ||
          menuRef.current?.clientHeight === menuWrapperRef.current?.clientHeight) {
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
    
  }, [wrapperScrollTop])

  useEffect(() => {
    if (menuWrapperRef.current !== undefined) {

      if( menuWrapperRef.current!.scrollTop === (menuWrapperRef.current!.scrollHeight - menuWrapperRef.current!.offsetHeight) ||
          menuRef.current?.clientHeight === menuWrapperRef.current?.clientHeight) {
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
    
  }, [containerBox])

  useEffect(() => {
    onChange && selectedOption && onSelectOption(selectedOption);
  }, [selectedOption]);
  
  useEffect(() => {
    const newSelectedOption = options.find(
      ({ value }) => defaultValue === value
    );
    onSelectOption(newSelectedOption);
  }, [defaultValue]);

  let lastScrollPos = 0;

  useEffect(() => {
    const scrollHandler = (e: any) => {

      if (initialPositioning) {
        initialPositioning = false;
        return;
      }

      let diff = menuWrapperRef.current!.scrollTop - lastScrollPos;
      // menuWrapperRef.current!.scrollTop = lastScrollPos;
      lastScrollPos = menuWrapperRef.current!.scrollTop;

      if( menuWrapperRef.current!.scrollTop === (menuWrapperRef.current!.scrollHeight - menuWrapperRef.current!.offsetHeight) ||
          menuRef.current?.clientHeight === menuWrapperRef.current?.clientHeight) {
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
        setContainerBox(box => {
          if (box.height - diff > wrapperMaxHeight) {
            return {
              height: wrapperMaxHeight,
              top: box.top
            }
          }
          // scroll up - grow by setting height and reposition to top
          return {
            height: box.height - diff,
            top: box.top
          }
        });
      } else {
        setContainerBox(box => {
          if (box.height + diff > wrapperMaxHeight) {
            return {
              height: wrapperMaxHeight,
              top: box.top
            }
          }

        // scroll down - only grow by setting height
          return {
            height: box.height + diff,
            top: box.top - diff
          }
        });
      }
    }

    if (menuWrapperRef.current) {
      lastScrollPos = menuWrapperRef.current!.scrollTop;
      menuWrapperRef.current.addEventListener('scroll', scrollHandler )
    }

    return () => { menuWrapperRef.current?.removeEventListener('scroll', scrollHandler) }
  })

  useEffect(() => {
    // Handler to call on window resize
    function handleResize() {
      onExpandedStateChange(false)
    }
    // Add event listener
    window.addEventListener("resize", handleResize);
    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Empty array ensures that effect is only run on mount


  useEffect(() => {

    let timeInterval = undefined as any

    const startScrollUp = (e: any) => {
      timeInterval = setInterval(() => {
        console.log('scrolling up');
        menuWrapperRef.current!.scrollTop  = menuWrapperRef.current!.scrollTop - 4        
      }, 20);
    };

    const stopScrollUp = (e: any) => {
      clearInterval(timeInterval);
    };

    if (scrollUpRef.current !== undefined) {
      scrollUpRef.current?.addEventListener('mouseover', startScrollUp)
      scrollUpRef.current?.addEventListener('mouseout', stopScrollUp)
    }

    return () => { 
      scrollUpRef.current?.removeEventListener('mouseover', startScrollUp)
      scrollUpRef.current?.removeEventListener('mouseout', stopScrollUp)
    }
  }, [scrollUpRef])

  useEffect(() => {

    let timeInterval = undefined as any

    const startScrollDown = (e: any) => {
      timeInterval = setInterval(() => {
        console.log('scrolling down');
        menuWrapperRef.current!.scrollTop  = menuWrapperRef.current!.scrollTop + 4
      }, 20);
    };

    const stopScrollDown = (e: any) => {
      clearInterval(timeInterval);
    };

    if (scrollDownRef.current !== undefined) {
      scrollDownRef.current?.addEventListener('mouseover', startScrollDown)
      scrollDownRef.current?.addEventListener('mouseout', stopScrollDown)
    }

    return () => { 
      scrollDownRef.current?.removeEventListener('mouseover', startScrollDown)
      scrollDownRef.current?.removeEventListener('mouseout', stopScrollDown)
    }
  }, [scrollDownRef])

  const handleExpandClick = () => { 
    console.log('handleExpandClick'); 
    onExpandedStateChange(!isExpanded)
  };

  const handleOutsideClick = () => { 
    console.log('clihandleOutsideClickck');
     onExpandedStateChange(false)
  };

  const handleSelectClick = (value: any) => {
    console.log('handle select click')
    const newOption = options.find(({ value: v }) => v === value);
    onExpandedStateChange(false);
    onSelectOption(newOption);

    onChange && onChange(newOption!);
  };

  const expandButtonClass = isExpanded ? "select-menu__button--active" : "";
  const expanListClass = isExpanded ? "select-menu__menu--active" : "";
  const disabledColorClass = isDisabled ? "icon--black-3" : "";

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
        <div ref={menuContainerRef} className="select-menu__menu_container" style={
            {
              height: containerBox.height + 'px',
              top: containerBox.top + 'px'
            }}>
          <div ref={scrollUpRef} className="select-menu__menu-scroll-up" style={{
            'visibility': canScrollUp ? 'visible' : 'hidden'  
          }}>
            <div className="svg-container arrow-up-svg" ></div>
          </div>
          <div ref={scrollDownRef} className="select-menu__menu-scroll-down" style={{
            'visibility': canScrollDown ? 'visible' : 'hidden' 
          }}>
            <div className="svg-container arrow-down-svg"></div> 
          </div>
          <div ref={menuWrapperRef} className="select-menu__menu_wrapper" >
            <ul ref={menuRef} 
              className={`select-menu__menu ${expanListClass} ${disabledColorClass}`}
              
            >
              {options &&
                options.map(({ value, label, divider, title, icon }, i) =>
                  divider ? (
                    <React.Fragment key={`select-option-divider--${i}`}>
                      {divider !== true && (
                        <span className="select-menu__divider-label">
                          {divider}
                        </span>
                      )}
                      <div
                        className="select-menu__divider"
                        key={`select-option--${i}`}
                      />
                    </React.Fragment>
                  ) : (
                    <li
                      className={`select-menu__item ${
                        selectedOption && selectedOption.value === value
                          ? "select-menu__item--selected"
                          : ""
                      }`}
                      onMouseUp={() => handleSelectClick(value)}
                      key={`select-option--${i}`}
                      title={title}
                    >
                    
                      <div className="select-menu__item-check">
                        { selectedOption && selectedOption.value === value && (
                        <div className={'svg-container checkmark-svg'} />
                        )}
                      </div>
                      <div className={'select-menu__item-icon'}>
                            <div className={'svg-container ' + icon} />
                      </div>
                      <span className="select-menu__item-label">{label}</span>
                    </li>
                  )
                )}
            </ul>
          </div>
        </div>
      </div>
    </OutsideClickHandler>
  );
};

export default Select;