import React, { useEffect, useState, useRef, createRef } from "react";
import OutsideClickHandler from "react-outside-click-handler";
import "./icon-select.css"

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

  const [isExpanded, onExpandedStateChange] = useState(false);
  const [selectedOption, onSelectOption] = useState(
    options.find(({ value }) => defaultValue === value)
  );
  useEffect(() => {
    onExpand && onExpand(isExpanded);
  }, [isExpanded]);

  useEffect(() => {
    onChange && selectedOption && onSelectOption(selectedOption);
  }, [selectedOption]);
  
  useEffect(() => {
    const newSelectedOption = options.find(
      ({ value }) => defaultValue === value
    );
    onSelectOption(newSelectedOption);
  }, [defaultValue]);


  useEffect(() => {
    // Handler to call on window resize
    function handleResize() {
      var rect= menuRef.current!.getBoundingClientRect();
      let widowWidth = window.innerWidth;
      const curStyle = menuRef.current!.style;
      if (rect.right+rect.width > widowWidth) {
        curStyle.right = '20px';
      }
      
    }
    // Add event listener
    window.addEventListener("resize", handleResize);
    // Call handler right away so state gets updated with initial window size
    handleResize();
    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, [isExpanded]); // Empty array ensures that effect is only run on mount


  const handleExpandClick = () => onExpandedStateChange(!isExpanded);

  const handleOutsideClick = () => onExpandedStateChange(false);

  const handleSelectClick = (value: any) => {
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
        <div className="circular-button-background" onClick={handleExpandClick} ><div className={(selectedOption?.icon ? selectedOption?.icon : unSelectedIcon)}></div></div>
        <ul ref={menuRef} 
          className={`select-menu__menu ${expanListClass} ${disabledColorClass}`}
          style={{ top: "-24px" }}
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
                  onClick={() => handleSelectClick(value)}
                  key={`select-option--${i}`}
                  title={title}
                >
                  <span className={"select-menu__item-icon " + icon}></span>
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