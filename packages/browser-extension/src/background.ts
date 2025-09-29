// Background service worker for the browser extension

import { BackgroundScriptManager } from './utils/background-script.js';

// Initialize background script manager
const backgroundManager = new BackgroundScriptManager();
backgroundManager.init();
