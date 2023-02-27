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
  const buttonRef = useRef<HTMLButtonElement>(null)

  
  const [isExpanded, onExpandedStateChange] = useState(false);
  const [selectedOption, onSelectOption] = useState(
    options.find(({ value }) => defaultValue === value)
  );

  let menuPositionIndex = options.findIndex(selectOption => selectedOption != undefined && selectOption.value === selectedOption?.value);

  useEffect(() => {
    onExpand && onExpand(isExpanded);

    console.log('isExpanded1')
  }, [isExpanded]);

  useEffect(() => {
    onChange && selectedOption && onSelectOption(selectedOption);
    console.log('selectedOption')
  }, [selectedOption]);
  
  useEffect(() => {
    const newSelectedOption = options.find(
      ({ value }) => defaultValue === value
    );
    onSelectOption(newSelectedOption);
    console.log('defaultValue')
  }, [defaultValue]);



  useEffect(() => {
    // Handler to call on window resize
    function handleResize() {
      
      console.log('updating position')
      var rect = buttonRef.current!.getBoundingClientRect();
      menuRef.current!.style.left = rect.left + 'px';
      menuRef.current!.style.top = rect.top + ((menuPositionIndex * -24) - 8) + 'px';

      console.log('calc position');
      console.log(rect.top);

      console.log('((menuPositionIndex * -24) - 8)')
      console.log(((menuPositionIndex * -24) - 8))
      
      
    }
    // Add event listener
    window.addEventListener("resize", handleResize);
    // Call handler right away so state gets updated with initial window size
    handleResize();

    console.log('isExpanded2')
    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, [isExpanded]); // Empty array ensures that effect is only run on mount


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

    onChange && onChange(newOption!)
    
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
    </OutsideClickHandler>
  );
};

export default Select;