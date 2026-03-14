export const TIMEOUTS = {
  DEFAULT_WAIT: 1000,
  NETWORK_CAPTURE_MAX: 30000,
  NETWORK_CAPTURE_IDLE: 3000,
  SCREENSHOT_DELAY: 100,
  KEYBOARD_DELAY: 50,
  CLICK_DELAY: 100,
} as const;

export const LIMITS = {
  MAX_NETWORK_REQUESTS: 100,
  MAX_SEARCH_RESULTS: 50,
  MAX_BOOKMARK_RESULTS: 100,
  MAX_HISTORY_RESULTS: 100,
  SIMILARITY_THRESHOLD: 0.1,
  VECTOR_DIMENSIONS: 384,
} as const;

export const ERROR_MESSAGES = {
  NATIVE_CONNECTION_FAILED: 'Failed to connect to native host',
  NATIVE_DISCONNECTED: 'Native connection disconnected',
  SERVER_STATUS_LOAD_FAILED: 'Failed to load server status',
  SERVER_STATUS_SAVE_FAILED: 'Failed to save server status',
  TOOL_EXECUTION_FAILED: 'Tool execution failed',
  INVALID_PARAMETERS: 'Invalid parameters provided',
  PERMISSION_DENIED: 'Permission denied',
  TAB_NOT_FOUND: 'Tab not found',
  ELEMENT_NOT_FOUND: 'Element not found',
  NETWORK_ERROR: 'Network error occurred',
} as const;

export const NETWORK_FILTERS = {
  EXCLUDED_DOMAINS: [
    'google-analytics.com',
    'googletagmanager.com',
    'analytics.google.com',
    'doubleclick.net',
    'googlesyndication.com',
    'googleads.g.doubleclick.net',
    'stats.g.doubleclick.net',
    'adservice.google.com',
    'pagead2.googlesyndication.com',
    'amazon-adsystem.com',
    'bat.bing.com',
    'clarity.ms',
    'connect.facebook.net',
    'facebook.com/tr',
    'analytics.twitter.com',
    'ads-twitter.com',
    'ads.yahoo.com',
    'adroll.com',
    'adnxs.com',
    'criteo.com',
    'quantserve.com',
    'scorecardresearch.com',
    'segment.io',
    'amplitude.com',
    'mixpanel.com',
    'optimizely.com',
    'static.hotjar.com',
    'script.hotjar.com',
    'crazyegg.com',
    'clicktale.net',
    'mouseflow.com',
    'fullstory.com',
    'linkedin.com/px',
  ],
  STATIC_RESOURCE_EXTENSIONS: [
    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp', '.cur',
    '.css', '.scss', '.less',
    '.js', '.jsx', '.ts', '.tsx', '.map',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ogg', '.wav',
    '.pdf', '.zip', '.rar', '.7z', '.iso', '.dmg',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  ],
  STATIC_MIME_TYPES_TO_FILTER: [
    'image/', 'font/', 'audio/', 'video/',
    'text/css', 'text/javascript',
    'application/javascript', 'application/x-javascript',
    'application/pdf', 'application/zip', 'application/octet-stream',
  ],
  API_MIME_TYPES: [
    'application/json', 'application/xml', 'text/xml', 'text/plain',
    'text/event-stream', 'application/x-www-form-urlencoded',
    'application/graphql', 'application/grpc',
    'application/protobuf', 'application/x-protobuf',
    'application/x-json', 'application/ld+json',
    'application/problem+json', 'application/problem+xml',
    'application/soap+xml', 'application/vnd.api+json',
  ],
  STATIC_RESOURCE_TYPES: ['stylesheet', 'image', 'font', 'media', 'other'],
} as const;

export const FILE_TYPES = {
  STATIC_EXTENSIONS: [
    '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf',
  ],
  FILTERED_MIME_TYPES: ['text/html', 'text/css', 'text/javascript', 'application/javascript'],
  IMAGE_FORMATS: ['png', 'jpeg', 'webp'] as const,
} as const;

export enum ExecutionWorld {
  ISOLATED = 'ISOLATED',
  MAIN = 'MAIN',
}
