/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable react/button-has-type */
/* eslint-disable jsx-a11y/no-redundant-roles */
import * as React from 'react';
import { useEffect, useState } from 'react';
import './MessagesConsumptionPaywall.css';

type MessagesConsumptionPaywallProps = {
  closeClick: () => void;
  buyClick: () => void;
  gotLicencesClick: () => void;
};

// eslint-disable-next-line no-empty-pattern
export default function MessagessConsumptionPaywall({
  closeClick,
  buyClick,
  gotLicencesClick,
}: MessagesConsumptionPaywallProps) {
  return (
    <div
      className="consumption_paywall_modals--largeModal"
      role="dialog"
      style={{ minWidth: '704px', maxWidth: '704px' }}
    >
      <div className="consumption_paywall_modals--largeModalTitle">Need more machine translations?</div>
      <button
        className="consumption_paywall_modals--closeButton"
        role="button"
        aria-label="Close"
        data-not-draggable="true"
        data-testid="close-button"
        onClick={closeClick}
      >
        <div className="svg-container cross-svg" />
        
      </button>
      <p className="consumption_paywall_modals--largeModalSubtitle">
        Parrot comes with 100 maschine translations, but getting more is easy.
      </p>
      <div className="consumption_paywall_modals--planBoxContainer">
        <div className="consumption_paywall_modals--planBox">
          <div>
            <p className="consumption_paywall_modals--planName">
              Translation Refill
              {/* <span data-tooltip-offset-x="0" className="badge--badgeLarge">
                Current plan
              </span> */}
            </p>
            <div style={{ height: '20px' }}>
              <p className="consumption_paywall_modals--planDescription">
                Boost your localization workflow with 1000 additional Maschine Translations
              </p>
            </div>
            <div className="consumption_paywall_modals--planBoxDivider" />
            <div className="consumption_paywall_modals--planFeatureList">
              <div className="consumption_paywall_modals--planFeatureParent">
                <span>
                  <span>✓ &nbsp;</span>
                  <span className="">Use in Unlimited files</span>
                </span>
              </div>
              <div className="consumption_paywall_modals--planFeatureParent">
                <span>
                  <span>✓ &nbsp;</span>
                  <span className="">1.000 additional Messages</span>
                </span>
              </div>
              <div className="consumption_paywall_modals--planFeatureParent">
                <span>
                  <span>✓ &nbsp;</span>
                  <span className="">no Subscription</span>
                </span>
              </div>
              <div className="consumption_paywall_modals--planFeatureParent">
                <span>
                  <span>✓ &nbsp;</span>
                  <span className="">secure payment via lemonsqueeze</span>
                </span>
              </div>
              <div style={{ height: 16 }} />
            </div>
          </div>
          <button
            className="consumption_paywall_modals--planButton"
            onClick={() => {
              buyClick();
            }}
          >
            Get a Refill
          </button>
          <p><a className="consumption_paywall_modals--licenseKey" onClick={gotLicencesClick}>I have a License key already</a></p>
        </div>

      </div>
    </div>
  );
}
