
  import * as React from "react";
  import { useEffect, useState } from "react";
  
  
  type ConfigViewProps = {
    
    linkStyle: string,
    setLinkStyle: Function
    // selectLanguage: Function,
  }
  
 export default function ConfigView(props: ConfigViewProps) {
    
    
    let [linkStyle, setLinkStyle] = useState(props.linkStyle)

    useEffect(() => {
        
    }, [])

    return (
        <div>
            <span onClick={e => {
                
            }}
            style={{visibility: 'hidden'}}>reset plugin State</span>

            <div>
            Link Style:<br/>
            <textarea
                style={{width:"445px", height:"185px"}}
                value={linkStyle}
                onChange={e => setLinkStyle(e.target.value)}
            /><br/>
            {linkStyle !== props.linkStyle && 
                    <>
                        <input type="button" value="Save" 
                        onClick={e => {
                                props.setLinkStyle(linkStyle)
                        }} />
                        <input type="button" value="Cancel" 
                        onClick={e => {
                            setLinkStyle(props.linkStyle);
                            
                        }} />
                    </>
                }
            {linkStyle === '' && 
                    
                        <input type="button" value="SampleValue" 
                        onClick={e => {
                                setLinkStyle(JSON.stringify({
                                    blendMode: "NORMAL",
                                    color: { r: 0, g: 0.5803921818733215, b: 0.529411792755127 },
                                    opacity: 1,
                                    type: "SOLID",
                                    visible: true
                                }, undefined, 4))
                            
                        }} />
                        
                }
                </div>
        </div>
    )
  }