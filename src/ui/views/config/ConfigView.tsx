/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useEffect, useState } from 'react';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';

  type ConfigViewProps = {

    linkStyle: string,
    setLinkStyle: Function
    translationKeyStore: MemoryTranslationKeyStore
    // selectLanguage: Function,
  };

export default function ConfigView({
  linkStyle,
  setLinkStyle,
  translationKeyStore,
}: ConfigViewProps) {
  const [linkStyleState, setLinkStyleState] = useState(linkStyle);

  useEffect(() => {

  }, []);

  return (
    <div>
      <div>
        <p onClick={() => { translationKeyStore.importFromLocalise(); }}>import from lokalise</p>
        Link Style:
        <br />
        <textarea
          style={{ width: '445px', height: '185px' }}
          value={linkStyleState}
          onChange={(e) => setLinkStyleState(e.target.value)}
        />
        <br />
        {linkStyleState !== linkStyle
                    && (
                    <>
                      <input
                        type="button"
                        value="Save"
                        onClick={() => {
                          setLinkStyle(linkStyleState);
                        }}
                      />
                      <input
                        type="button"
                        value="Cancel"
                        onClick={() => {
                          setLinkStyleState(linkStyle);
                        }}
                      />
                    </>
                    )}
        {linkStyleState === ''

                        && (
                        <input
                          type="button"
                          value="SampleValue"
                          onClick={() => {
                            setLinkStyleState(JSON.stringify({
                              blendMode: 'NORMAL',
                              color: { r: 0, g: 0.5803921818733215, b: 0.529411792755127 },
                              opacity: 1,
                              type: 'SOLID',
                              visible: true,
                            }, undefined, 4));
                          }}
                        />
                        )}
      </div>
    </div>
  );
}
