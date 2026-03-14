import { getToolSchemas, executeToolCall } from './tool-registry';

const WS_URL = 'ws://127.0.0.1:12307';
const KEEPALIVE_ALARM = 'ws-keepalive';
const KEEPALIVE_INTERVAL_MIN = 0.33; // ~20s (chrome.alarms minimum is ~0.33min in MV3)
const RECONNECT_ALARM = 'ws-reconnect';

let ws: WebSocket | null = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

function send(msg: Record<string, unknown>): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(msg));
  return true;
}

async function handleMessage(raw: string) {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.type === 'ping') {
    send({ type: 'pong' });
    return;
  }

  if (msg.type === 'list_tools') {
    const schemas = getToolSchemas();
    send({ type: 'tool_list', id: msg.id, tools: schemas });
    return;
  }

  if (msg.type === 'call_tool') {
    try {
      const result = await executeToolCall(msg.name, msg.args || {});
      send({ type: 'tool_result', id: msg.id, content: result.content, isError: result.isError });
    } catch (error) {
      send({
        type: 'tool_result',
        id: msg.id,
        content: [{ type: 'text', text: `Tool execution error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      });
    }
    return;
  }
}

function scheduleReconnect() {
  chrome.alarms.create(RECONNECT_ALARM, { delayInMinutes: reconnectDelay / 60000 });
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

export function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING))
    return;

  try {
    ws = new WebSocket(WS_URL);
  } catch {
    console.warn('[WS] Failed to create WebSocket, scheduling reconnect');
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[WS] Connected to', WS_URL);
    reconnectDelay = 1000;
    chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_INTERVAL_MIN });
  };

  ws.onmessage = (event) => {
    handleMessage(typeof event.data === 'string' ? event.data : String(event.data));
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected');
    ws = null;
    chrome.alarms.clear(KEEPALIVE_ALARM);
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    console.warn('[WS] Error:', err);
    // onclose will fire after onerror, triggering reconnect
  };
}

export function handleAlarm(alarm: chrome.alarms.Alarm) {
  if (alarm.name === KEEPALIVE_ALARM) {
    if (ws?.readyState === WebSocket.OPEN)
      send({ type: 'pong' });
    else
      connect();
    return;
  }

  if (alarm.name === RECONNECT_ALARM) {
    connect();
    return;
  }
}
