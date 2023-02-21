import { debug } from "console";
import * as React from "react";
import { useState, useEffect } from "react";
import * as ReactDOM from "react-dom";
import FigmaHelper from "../../../shared/FigmaHelper";


type SearchKeyListProps = {
    figmaHelper: FigmaHelper
    forKey: string
    searchString: string,
    onCopyFrommExisting: (fromKey: string, forKey: string) => void,
    onCancel: () => void
  }
  

export default function SearchKeyList(props: SearchKeyListProps) {

    const [keys, setKeys] = useState({})
    const [query, setQuery] = useState(props.searchString)

    useEffect(() => {
        (async ()=>{
            /*let states = await props.figmaHelper.getLocalitzationStates();
            setKeys(states);*/
        })()
    }, [])

    const filterKeys = (allKeys: any, filter: string) => {
        let keys = [];
        

        for (let key of Object.keys(allKeys)) {

            let match = false;
            let currentKey = {
                key: key,
                translations: [] as any[]
            }
            for (let language of Object.keys(allKeys[key].translations)) {
                
                let translation = allKeys[key].translations[language]
                if (typeof translation == 'string') {
                    currentKey.translations.push({language: language, translation: translation});
                    
                    if (!filter || translation.toLowerCase().indexOf(filter.toLowerCase()) != -1) {
                        match = true;
                        
                    }
                }
                
            }

            if (match) {
                match = false
                keys.push(currentKey);
            }
        }

        return keys;

    }

    const onSearchChange = (e: any) => {
        
        setQuery(e.target.value)
    }

    let filteredKeys = filterKeys(keys, query)
    
    return (
        <div id="key-search-table">
            search:
            <input onChange={onSearchChange} value={query} type="search"/><input type="button" value={'cancel'} onClick={e => props.onCancel()}/>
            
            {filteredKeys.length === 0 && 
                <b>No matching keys found</b>
            }
            {filteredKeys.length > 0 && 
            <>
            <br/>Found: {filteredKeys.length}
            <table style={{height: '1px'}}>
                <tbody>
                    {filteredKeys.map(key => {
                        
                    return <tr key={key.key}>
                        <td><span>{key.key}</span></td>
                        <td>
                        {key.translations.map(translation => {
                            
                            return (<div key={key.key + '-' + translation.language}>
                                <span>{false && translation.language}</span>
                                <span>{translation.translation}</span>
                            </div>)
                        })}
                        </td>
                        <td>
                            <div>
                                <span onClick={e => {
                                    props.onCopyFrommExisting(key.key, props.forKey)
                                }}>copy</span>
                            </div>
                        </td>
                    </tr>
                    })}

                </tbody>    
            </table>
            </>
            }
        </div>
    )
}

