export interface ScreenshotContext {
  screenshotWidth: number;
  screenshotHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio?: number;
  hostname?: string;
  timestamp: number;
}

const TTL_MS = 5 * 60 * 1000;

const contexts = new Map<number, ScreenshotContext>();

export const screenshotContextManager = {
  setContext(tabId: number, ctx: Omit<ScreenshotContext, 'timestamp'>) {
    contexts.set(tabId, { ...ctx, timestamp: Date.now() });
  },
  getContext(tabId: number): ScreenshotContext | undefined {
    const ctx = contexts.get(tabId);
    if (!ctx) return undefined;
    if (Date.now() - ctx.timestamp > TTL_MS) {
      contexts.delete(tabId);
      return undefined;
    }
    return ctx;
  },
  clear(tabId: number) {
    contexts.delete(tabId);
  },
};

export function scaleCoordinates(
  x: number,
  y: number,
  ctx: ScreenshotContext,
): { x: number; y: number } {
  if (!ctx.screenshotWidth || !ctx.screenshotHeight || !ctx.viewportWidth || !ctx.viewportHeight)
    return { x, y };

  const sx = (x / ctx.screenshotWidth) * ctx.viewportWidth;
  const sy = (y / ctx.screenshotHeight) * ctx.viewportHeight;
  return { x: Math.round(sx), y: Math.round(sy) };
}
