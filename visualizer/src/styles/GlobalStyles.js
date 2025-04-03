import { createGlobalStyle } from 'styled-components';
import theme from './theme';

/**
 * Global style definitions for the entire application.
 * Includes CSS reset and base element styling.
 */
const GlobalStyles = createGlobalStyle`
  /* CSS Reset */
  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body, div, span, applet, object, iframe,
  h1, h2, h3, h4, h5, h6, p, blockquote, pre,
  a, abbr, acronym, address, big, cite, code,
  del, dfn, em, img, ins, kbd, q, s, samp,
  small, strike, strong, sub, sup, tt, var,
  b, u, i, center,
  dl, dt, dd, ol, ul, li,
  fieldset, form, label, legend,
  table, caption, tbody, tfoot, thead, tr, th, td,
  article, aside, canvas, details, embed, 
  figure, figcaption, footer, header, hgroup, 
  menu, nav, output, ruby, section, summary,
  time, mark, audio, video {
    margin: 0;
    padding: 0;
    border: 0;
    font-size: 100%;
    vertical-align: baseline;
  }

  /* HTML5 display-role reset for older browsers */
  article, aside, details, figcaption, figure, 
  footer, header, hgroup, menu, nav, section {
    display: block;
  }

  html {
    font-size: ${theme.typography.fontSize}px;
    line-height: 1.5;
    height: 100%;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: ${theme.typography.fontFamily};
    font-size: ${theme.typography.body1.fontSize};
    font-weight: ${theme.typography.fontWeightRegular};
    line-height: ${theme.typography.body1.lineHeight};
    color: ${theme.colors.text.primary};
    background-color: ${theme.colors.background.default};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    height: 100%;
    overflow: hidden;
  }

  #root {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Typography */
  h1, .h1 {
    font-size: ${theme.typography.h1.fontSize};
    font-weight: ${theme.typography.h1.fontWeight};
    line-height: ${theme.typography.h1.lineHeight};
    letter-spacing: ${theme.typography.h1.letterSpacing};
    margin-bottom: 0.5em;
  }

  h2, .h2 {
    font-size: ${theme.typography.h2.fontSize};
    font-weight: ${theme.typography.h2.fontWeight};
    line-height: ${theme.typography.h2.lineHeight};
    letter-spacing: ${theme.typography.h2.letterSpacing};
    margin-bottom: 0.5em;
  }

  h3, .h3 {
    font-size: ${theme.typography.h3.fontSize};
    font-weight: ${theme.typography.h3.fontWeight};
    line-height: ${theme.typography.h3.lineHeight};
    letter-spacing: ${theme.typography.h3.letterSpacing};
    margin-bottom: 0.5em;
  }

  h4, .h4 {
    font-size: ${theme.typography.h4.fontSize};
    font-weight: ${theme.typography.h4.fontWeight};
    line-height: ${theme.typography.h4.lineHeight};
    letter-spacing: ${theme.typography.h4.letterSpacing};
    margin-bottom: 0.5em;
  }

  h5, .h5 {
    font-size: ${theme.typography.h5.fontSize};
    font-weight: ${theme.typography.h5.fontWeight};
    line-height: ${theme.typography.h5.lineHeight};
    letter-spacing: ${theme.typography.h5.letterSpacing};
    margin-bottom: 0.5em;
  }

  h6, .h6 {
    font-size: ${theme.typography.h6.fontSize};
    font-weight: ${theme.typography.h6.fontWeight};
    line-height: ${theme.typography.h6.lineHeight};
    letter-spacing: ${theme.typography.h6.letterSpacing};
    margin-bottom: 0.5em;
  }

  p {
    margin-bottom: 1em;
  }

  strong, b {
    font-weight: ${theme.typography.fontWeightBold};
  }

  small {
    font-size: ${theme.typography.caption.fontSize};
  }

  a {
    color: ${theme.colors.primary.main};
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  /* Forms */
  button, input, select, textarea {
    font-family: inherit;
    font-size: 100%;
    line-height: 1.15;
    margin: 0;
  }

  button, input {
    overflow: visible;
  }

  button, select {
    text-transform: none;
  }

  button, [type="button"], [type="reset"], [type="submit"] {
    -webkit-appearance: button;
  }

  /* Layout utility classes */
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 ${theme.spacing(2)};
  }

  /* Visualizer specific styles */
  .app-layout {
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  .app-sidebar {
    width: 280px;
    min-width: 280px;
    background-color: ${theme.colors.background.paper};
    border-right: 1px solid ${theme.colors.neutral.gray300};
    z-index: 10;
    transition: width 0.3s ease;
    display: flex;
    flex-direction: column;
  }

  .sidebar-collapsed {
    width: 64px;
    min-width: 64px;
  }

  .app-content {
    flex: 1;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .visualization-container {
    position: relative;
    flex: 1;
    overflow: hidden;
  }

  .visualization-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .details-panel {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 400px;
    max-width: calc(100% - 40px);
    max-height: calc(100% - 40px);
    background-color: ${theme.colors.background.paper};
    border-radius: 4px;
    box-shadow: ${theme.shadows.lg};
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .details-panel-empty {
    width: 300px;
  }

  .panel-header {
    padding: ${theme.spacing(2)};
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid ${theme.colors.neutral.gray300};
  }

  .panel-tabs {
    display: flex;
    border-bottom: 1px solid ${theme.colors.neutral.gray300};
  }

  .tab-button {
    flex: 1;
    padding: ${theme.spacing(1)} ${theme.spacing(2)};
    background: none;
    border: none;
    cursor: pointer;
    font-weight: ${theme.typography.fontWeightMedium};
    color: ${theme.colors.text.secondary};
    transition: all 0.2s ease;
  }

  .tab-button.active {
    color: ${theme.colors.primary.main};
    border-bottom: 2px solid ${theme.colors.primary.main};
  }

  .panel-content {
    padding: ${theme.spacing(2)};
    overflow-y: auto;
    flex: 1;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.8);
    z-index: 100;
  }

  .loading-spinner {
    width: 50px;
    height: 50px;
    border: 5px solid ${theme.colors.neutral.gray300};
    border-top-color: ${theme.colors.primary.main};
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: ${theme.spacing(2)};
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Form styles */
  .form-group {
    margin-bottom: ${theme.spacing(2)};
  }

  .form-group label {
    display: block;
    margin-bottom: ${theme.spacing(0.5)};
    font-weight: ${theme.typography.fontWeightMedium};
  }

  .form-group input, 
  .form-group textarea, 
  .form-group select {
    width: 100%;
    padding: ${theme.spacing(1)};
    border: 1px solid ${theme.colors.neutral.gray400};
    border-radius: 4px;
    background-color: ${theme.colors.neutral.white};
    transition: border-color 0.2s ease;
  }

  .form-group input:focus, 
  .form-group textarea:focus, 
  .form-group select:focus {
    border-color: ${theme.colors.primary.main};
    outline: none;
  }

  .form-group.has-error input, 
  .form-group.has-error textarea, 
  .form-group.has-error select {
    border-color: ${theme.colors.error.main};
  }

  .error-message {
    color: ${theme.colors.error.main};
    font-size: ${theme.typography.caption.fontSize};
    margin-top: ${theme.spacing(0.5)};
  }

  .required-indicator {
    color: ${theme.colors.error.main};
    margin-left: ${theme.spacing(0.5)};
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: ${theme.spacing(1)};
    margin-top: ${theme.spacing(3)};
  }

  button {
    padding: ${theme.spacing(1)} ${theme.spacing(2)};
    border-radius: 4px;
    font-weight: ${theme.typography.fontWeightMedium};
    cursor: pointer;
    transition: all 0.2s ease;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .primary-button, .save-button {
    background-color: ${theme.colors.primary.main};
    color: ${theme.colors.primary.contrastText};
    border: none;
  }

  .primary-button:hover, .save-button:hover {
    background-color: ${theme.colors.primary.dark};
  }

  .secondary-button, .cancel-button {
    background-color: transparent;
    color: ${theme.colors.text.primary};
    border: 1px solid ${theme.colors.neutral.gray400};
  }

  .secondary-button:hover, .cancel-button:hover {
    background-color: ${theme.colors.neutral.gray100};
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    padding: 0;
    cursor: pointer;
    color: ${theme.colors.text.secondary};
  }

  .close-button:hover {
    color: ${theme.colors.text.primary};
  }

  /* Relationship list styles */
  .relationship-list {
    list-style-type: none;
    margin: 0;
    padding: 0;
  }

  .relationship-item {
    padding: ${theme.spacing(1)} 0;
    border-bottom: 1px solid ${theme.colors.neutral.gray200};
  }

  .relationship-item:last-child {
    border-bottom: none;
  }

  .relationship-type {
    font-weight: ${theme.typography.fontWeightMedium};
    margin-right: ${theme.spacing(1)};
  }

  /* Metadata list styles */
  .metadata-list {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: ${theme.spacing(1)};
  }

  .metadata-list dt {
    font-weight: ${theme.typography.fontWeightMedium};
    color: ${theme.colors.text.secondary};
  }
`;

export default GlobalStyles; 