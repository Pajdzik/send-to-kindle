// Content script to extract page content and communicate with background script

import { ContentScriptHandler } from './utils/content-script.js';

// Initialize content script handler
const contentHandler = new ContentScriptHandler();
contentHandler.init();
