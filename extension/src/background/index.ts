import { connect, handleAlarm } from './ws-client';

console.log('[Agy] Background service worker starting...');

// Connect on startup
connect();

// Reconnect on install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Agy] Extension installed/updated, connecting...');
  connect();
});

// Handle keepalive and reconnect alarms
chrome.alarms.onAlarm.addListener(handleAlarm);

// Reconnect when service worker wakes up
chrome.runtime.onStartup.addListener(() => {
  console.log('[Agy] Browser startup, connecting...');
  connect();
});
