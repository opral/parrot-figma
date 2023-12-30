/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable react/button-has-type */
/* eslint-disable jsx-a11y/no-redundant-roles */
import * as React from 'react';
import { useEffect, useState } from 'react';
import './ConsumptionPaywall.css';

type ConsumptionPaywallProps = {
  showAllFeatures: () => void;
  upgradePlan: () => void;
};

const features = {
  aiTranslation: '',
};

// eslint-disable-next-line no-empty-pattern
export default function ConsumptionPaywall({
  showAllFeatures,
  upgradePlan,
}: ConsumptionPaywallProps) {
  return (
    <div
      className="consumption_paywall_modals--largeModal"
      role="dialog"
      style={{ minWidth: '704px', maxWidth: '704px' }}
    >
      <div className="consumption_paywall_modals--largeModalTitle">Need more variable modes?</div>
      <button
        className="consumption_paywall_modals--closeButton"
        role="button"
        aria-label="Close"
        data-not-draggable="true"
        data-testid="close-button"
      >
        <span className="svg-container">
          <svg
            className="svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 5.293l4.789-4.79.707.708-4.79 4.79 4.79 4.789-.707.707-4.79-4.79-4.789 4.79-.707-.707L5.293 6 .502 1.211 1.21.504 6 5.294z"
              fillRule="nonzero"
              fillOpacity="1"
              fill="#000"
              stroke="none"
            />
          </svg>
        </span>
      </button>
      <p className="consumption_paywall_modals--largeModalSubtitle">
        Your plan comes with one mode—upgrade to create more.
      </p>
      <div className="consumption_paywall_modals--planBoxContainer">
        <div className="consumption_paywall_modals--planBox">
          <div>
            <p className="consumption_paywall_modals--planName">
              Starter
              <span data-tooltip-offset-x="0" className="badge--badgeLarge">
                Current plan
              </span>
            </p>
            <div style={{ height: '64px' }}>
              <p className="consumption_paywall_modals--planDescription">
                See your Designs in different Languages
              </p>
              <div
                className="consumption_paywall_modals--starterPriceRow"
                data-testid="pricing-starter"
                style={{ height: '40px' }}
              >
                <div>
                  <strong className="consumption_paywall_modals--costText">Free</strong> for one
                  Designer
                </div>
              </div>
            </div>
            <div className="consumption_paywall_modals--planBoxDivider" />
            <div className="consumption_paywall_modals--planFeatureList">
              <div className="consumption_paywall_modals--planFeatureParent">
                <span>
                  <span>✓ &nbsp;</span>
                  <span className="">Unlimited files</span>
                </span>
              </div>
              <div className="consumption_paywall_modals--planFeatureParent">
                <span>
                  <span>✓ &nbsp;</span>
                  <span className="">10k Chars/mo. AI translation included</span>
                </span>
              </div>
              <div className="consumption_paywall_modals--planFeatureParent">
                <span>
                  <span>✓ &nbsp;</span>
                  <span className="">1 mode for variables</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="consumption_paywall_modals--planBox">
          <div>
            <p className="consumption_paywall_modals--planName">Professional</p>
            <div style={{ height: '64px' }}>
              <p className="consumption_paywall_modals--planDescription">
                Per editor per month when billed annually
              </p>
              <div
                className="consumption_paywall_modals--priceRow"
                data-testid="pricing-pro-design"
              >
                <span className="consumption_paywall_modals--priceIconAndProductName">
                  <div className="consumption_paywall_modals--priceIcon">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <path
                        className="file_icons--designFilePrimary"
                        d="M7 28H25C25.5523 28 26 27.5523 26 27V9.91421C26 9.649 25.8946 9.39464 25.7071 9.20711L20.7929 4.29289C20.6054 4.10536 20.351 4 20.0858 4H7C6.44772 4 6 4.44772 6 5V27C6 27.5523 6.44772 28 7 28Z"
                      />
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M16.8582 12.9953L16.8466 12.992L12.4437 11.7366L15.7009 14.9938C15.8169 14.954 15.9412 14.9324 16.0707 14.9324C16.6993 14.9324 17.2089 15.442 17.2089 16.0707C17.2089 16.6993 16.6993 17.2089 16.0707 17.2089C15.442 17.2089 14.9324 16.6993 14.9324 16.0707C14.9324 15.9412 14.954 15.8169 14.9938 15.7009L11.7425 12.4496L12.9443 16.6419L12.9548 16.6784L12.9625 16.7156C13.26 18.1592 14.5397 19.2442 16.0707 19.2442C16.4199 19.2442 16.7541 19.1882 17.0659 19.0854L17.6507 18.8924L18.0862 19.3279L19.3171 20.5588L20.5858 19.2901L19.3411 18.0455L18.9107 17.615L19.0954 17.035C19.1918 16.7321 19.2443 16.4085 19.2443 16.0707C19.2443 14.5951 18.2363 13.3524 16.8699 12.9983L16.8582 12.9953ZM21.2929 18.583L22 19.2901L21.2929 19.9972L20.0242 21.2659L19.3171 21.973L18.61 21.2659L17.3791 20.035C16.9676 20.1708 16.5277 20.2442 16.0707 20.2442C14.0558 20.2442 12.3744 18.8165 11.983 16.9175L10.3246 11.1324L10 10L11.1329 10.323L17.1208 12.0303C18.9175 12.4959 20.2443 14.1283 20.2443 16.0707C20.2443 16.5127 20.1756 16.9386 20.0482 17.3384L21.2929 18.583Z"
                        fill="var(--color-icon-ondesign, white)"
                      />
                      <path
                        d="M20.5 8.5V6.41421V4L22.2071 5.70711L24.2929 7.79289L26 9.5H23.5858H21.5C20.9477 9.5 20.5 9.05228 20.5 8.5Z"
                        fill="var(--color-icondesignfilesecondary, #9bd5fd)"
                      />
                    </svg>
                  </div>
                  <span className="consumption_paywall_modals--priceRowProductName">
                    Figma design
                  </span>
                </span>
                <span className="consumption_paywall_modals--costText">12&nbsp;€</span>
              </div>
            </div>
            <div className="consumption_paywall_modals--planBoxDivider" />
            <div className="consumption_paywall_modals--planFeatureList">
              <div className="consumption_paywall_modals--planFeatureParent">
                <span>
                  <span>✓ &nbsp;</span>
                  <span className="">Unlimited files</span>
                </span>
              </div>
              <div className="consumption_paywall_modals--planFeatureParent">
                <span>
                  <span>✓ &nbsp;</span>
                  <span className="">4 modes for variables</span>
                </span>
              </div>
              <div className="consumption_paywall_modals--planFeatureParent">
                <span>
                  <span>✓ &nbsp;</span>
                  <span className="">Shared team libraries</span>
                </span>
              </div>
              <div className="consumption_paywall_modals--planFeatureParent">
                <span>
                  <span style={{ visibility: 'hidden' }}>✓ &nbsp;</span>
                  <span className="">
                    <a
                      onClick={() => {
                        showAllFeatures();
                      }}
                      className="basic_form--inlineLink--aRePo blue_link--blueLink "
                      rel="noopener noreferrer"
                    >
                      See all features →
                    </a>
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div aria-hidden="true" style={{ height: '24px' }} />
          <button
            className="consumption_paywall_modals--planButton"
            onClick={() => {
              upgradePlan();
            }}
          >
            Upgrade to Professional
          </button>
        </div>
      </div>
    </div>
  );
}
