import { createErrorResponse, ToolResult } from './types';
import { BaseBrowserToolExecutor } from './base-browser';
import { TOOL_NAMES } from './names';
import { TOOL_MESSAGE_TYPES } from './message-types';
import {
  canvasToDataURL,
  createImageBitmapFromUrl,
  cropAndResizeImage,
  stitchImages,
  compressImage,
} from '../utils/image-utils';
import { screenshotContextManager } from '../utils/screenshot-context';

const SCREENSHOT_CONSTANTS = {
  SCROLL_DELAY_MS: 350,
  CAPTURE_STITCH_DELAY_MS: 50,
  MAX_CAPTURE_PARTS: 50,
  MAX_CAPTURE_HEIGHT_PX: 50000,
  PIXEL_TOLERANCE: 1,
  SCRIPT_INIT_DELAY: 100,
} as {
  readonly SCROLL_DELAY_MS: number;
  CAPTURE_STITCH_DELAY_MS: number;
  readonly MAX_CAPTURE_PARTS: number;
  readonly MAX_CAPTURE_HEIGHT_PX: number;
  readonly PIXEL_TOLERANCE: number;
  readonly SCRIPT_INIT_DELAY: number;
};

const __MAX_CAP_RATE: number | undefined = (chrome.tabs as any)
  ?.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND;
if (typeof __MAX_CAP_RATE === 'number' && __MAX_CAP_RATE > 0) {
  const minIntervalMs = Math.ceil(1000 / __MAX_CAP_RATE);
  const requiredExtraDelay = Math.max(0, minIntervalMs - SCREENSHOT_CONSTANTS.SCROLL_DELAY_MS);
  SCREENSHOT_CONSTANTS.CAPTURE_STITCH_DELAY_MS = Math.max(
    requiredExtraDelay,
    SCREENSHOT_CONSTANTS.CAPTURE_STITCH_DELAY_MS,
  );
}

interface ScreenshotToolParams {
  name: string;
  selector?: string;
  tabId?: number;
  background?: boolean;
  windowId?: number;
  width?: number;
  height?: number;
  storeBase64?: boolean;
  fullPage?: boolean;
  savePng?: boolean;
  maxHeight?: number;
}

interface ScreenshotPageDetails {
  totalWidth: number;
  totalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  currentScrollX: number;
  currentScrollY: number;
}

const PAGE_DETAILS_REQUIRED_FIELDS: Array<keyof ScreenshotPageDetails> = [
  'totalWidth',
  'totalHeight',
  'viewportWidth',
  'viewportHeight',
  'devicePixelRatio',
  'currentScrollX',
  'currentScrollY',
];

function assertValidPageDetails(details: unknown): ScreenshotPageDetails {
  if (!details || typeof details !== 'object')
    throw new Error(
      'Screenshot helper did not respond. The content script may not be injected or cannot run on this page.',
    );

  const candidate = details as Partial<ScreenshotPageDetails>;
  const invalidFields = PAGE_DETAILS_REQUIRED_FIELDS.filter(
    (field) => typeof candidate[field] !== 'number' || !Number.isFinite(candidate[field]),
  );

  if (invalidFields.length > 0)
    throw new Error(
      `Screenshot helper returned invalid page details (missing/invalid: ${invalidFields.join(', ')}).`,
    );

  return candidate as ScreenshotPageDetails;
}

class ScreenshotTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.SCREENSHOT;

  async execute(args: ScreenshotToolParams): Promise<ToolResult> {
    const {
      name = 'screenshot',
      selector,
      storeBase64 = false,
      fullPage = false,
      savePng = true,
    } = args;

    console.log(`Starting screenshot with options:`, args);

    const explicit = await this.tryGetTab(args.tabId);
    const tab = explicit || (await this.getActiveTabOrThrowInWindow(args.windowId));

    if (
      tab.url?.startsWith('chrome://') ||
      tab.url?.startsWith('edge://') ||
      tab.url?.startsWith('https://chrome.google.com/webstore') ||
      tab.url?.startsWith('https://microsoftedge.microsoft.com/')
    )
      return createErrorResponse(
        'Cannot capture special browser pages or web store pages due to security restrictions.',
      );

    let finalImageDataUrl: string | undefined;
    let finalImageWidthCss: number | undefined;
    let finalImageHeightCss: number | undefined;
    const results: any = { base64: null, fileSaved: false };
    let originalScroll: { x: number; y: number } | null = null;
    let didPreparePage = false;
    let pageDetails: ScreenshotPageDetails | undefined;

    try {
      const background = args.background === true;
      const canUseCdpCapture = background && !fullPage && !selector;

      if (canUseCdpCapture) {
        try {
          const tabId = tab.id!;
          const { cdpSessionManager } = await import('../utils/cdp-session-manager');
          await cdpSessionManager.withSession(tabId, 'screenshot', async () => {
            const metrics: any = await cdpSessionManager.sendCommand(
              tabId,
              'Page.getLayoutMetrics',
              {},
            );
            const viewport = metrics?.layoutViewport ||
              metrics?.visualViewport || {
                clientWidth: 800,
                clientHeight: 600,
                pageX: 0,
                pageY: 0,
              };
            const shot: any = await cdpSessionManager.sendCommand(tabId, 'Page.captureScreenshot', {
              format: 'png',
            });
            const base64Data = typeof shot?.data === 'string' ? shot.data : '';
            if (!base64Data)
              throw new Error('CDP Page.captureScreenshot returned empty data');
            finalImageDataUrl = `data:image/png;base64,${base64Data}`;
            finalImageWidthCss = Math.round(viewport.clientWidth || 800);
            finalImageHeightCss = Math.round(viewport.clientHeight || 600);
          });
        } catch (e) {
          console.warn('CDP viewport capture failed, falling back to helper path:', e);
        }
      }

      if (!finalImageDataUrl) {
        await this.injectContentScript(tab.id!, ['inject-scripts/screenshot-helper.js']);
        await new Promise((resolve) => setTimeout(resolve, SCREENSHOT_CONSTANTS.SCRIPT_INIT_DELAY));

        const prepareResp = await this.sendMessageToTab(tab.id!, {
          action: TOOL_MESSAGE_TYPES.SCREENSHOT_PREPARE_PAGE_FOR_CAPTURE,
          options: { fullPage },
        });
        if (!prepareResp || prepareResp.success !== true)
          throw new Error(
            'Screenshot helper did not acknowledge page preparation. The content script may not be injected or cannot run on this page.',
          );
        didPreparePage = true;

        const rawPageDetails = await this.sendMessageToTab(tab.id!, {
          action: TOOL_MESSAGE_TYPES.SCREENSHOT_GET_PAGE_DETAILS,
        });
        pageDetails = assertValidPageDetails(rawPageDetails);
        originalScroll = { x: pageDetails.currentScrollX, y: pageDetails.currentScrollY };

        if (fullPage) {
          finalImageDataUrl = await this._captureFullPage(tab.id!, args, pageDetails);
          if (args.width && args.height) {
            finalImageWidthCss = args.width;
            finalImageHeightCss = args.height;
          } else if (args.width && !args.height) {
            finalImageWidthCss = args.width;
            const ratio = pageDetails.totalHeight / pageDetails.totalWidth;
            finalImageHeightCss = Math.round(args.width * ratio);
          } else if (!args.width && args.height) {
            finalImageHeightCss = args.height;
            const ratio = pageDetails.totalWidth / pageDetails.totalHeight;
            finalImageWidthCss = Math.round(args.height * ratio);
          } else {
            finalImageWidthCss = pageDetails.totalWidth;
            finalImageHeightCss = pageDetails.totalHeight;
          }
        } else if (selector) {
          finalImageDataUrl = await this._captureElement(
            tab.id!,
            args,
            pageDetails.devicePixelRatio,
          );
          if (args.width && args.height) {
            finalImageWidthCss = args.width;
            finalImageHeightCss = args.height;
          } else {
            finalImageWidthCss = pageDetails.viewportWidth;
            finalImageHeightCss = pageDetails.viewportHeight;
          }
        } else {
          finalImageDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
          finalImageWidthCss = pageDetails.viewportWidth;
          finalImageHeightCss = pageDetails.viewportHeight;
        }
      }

      if (!finalImageDataUrl)
        throw new Error('Failed to capture image data');

      try {
        if (typeof finalImageWidthCss === 'number' && typeof finalImageHeightCss === 'number') {
          let hostname = '';
          try {
            hostname = tab.url ? new URL(tab.url).hostname : '';
          } catch {
            // ignore
          }
          const viewportWidth = pageDetails?.viewportWidth ?? finalImageWidthCss;
          const viewportHeight = pageDetails?.viewportHeight ?? finalImageHeightCss;
          screenshotContextManager.setContext(tab.id!, {
            screenshotWidth: finalImageWidthCss,
            screenshotHeight: finalImageHeightCss,
            viewportWidth,
            viewportHeight,
            devicePixelRatio: pageDetails?.devicePixelRatio,
            hostname,
          });
        }
      } catch (e) {
        console.warn('Failed to set screenshot context:', e);
      }

      if (storeBase64 === true) {
        const compressed = await compressImage(finalImageDataUrl, {
          scale: 0.7,
          quality: 0.8,
          format: 'image/jpeg',
        });
        const base64Data = compressed.dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
        results.base64 = base64Data;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ base64Data, mimeType: compressed.mimeType }),
            },
          ],
          isError: false,
        };
      }

      if (savePng === true) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${name.replace(/[^a-z0-9_-]/gi, '_') || 'screenshot'}_${timestamp}.png`;

          const downloadId = await chrome.downloads.download({
            url: finalImageDataUrl,
            filename: filename,
            saveAs: false,
          });

          results.downloadId = downloadId;
          results.filename = filename;
          results.fileSaved = true;

          try {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const [downloadItem] = await chrome.downloads.search({ id: downloadId });
            if (downloadItem && downloadItem.filename)
              results.fullPath = downloadItem.filename;
          } catch (pathError) {
            console.warn('Could not get full file path:', pathError);
          }
        } catch (error) {
          console.error('Error saving PNG file:', error);
          results.saveError = String(error instanceof Error ? error.message : error);
        }
      }
    } catch (error) {
      console.error('Error during screenshot execution:', error);
      return createErrorResponse(
        `Screenshot error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );
    } finally {
      if (didPreparePage) {
        try {
          const resetMessage: Record<string, unknown> = {
            action: TOOL_MESSAGE_TYPES.SCREENSHOT_RESET_PAGE_AFTER_CAPTURE,
          };
          if (originalScroll) {
            resetMessage.scrollX = originalScroll.x;
            resetMessage.scrollY = originalScroll.y;
          }
          await this.sendMessageToTab(tab.id!, resetMessage);
        } catch (err) {
          console.warn('Failed to reset page, tab might have closed:', err);
        }
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Screenshot [${name}] captured successfully`,
            tabId: tab.id,
            url: tab.url,
            name: name,
            ...results,
          }),
        },
      ],
      isError: false,
    };
  }

  async _captureElement(
    tabId: number,
    options: ScreenshotToolParams,
    pageDpr: number,
  ): Promise<string> {
    const elementDetails = await this.sendMessageToTab(tabId, {
      action: TOOL_MESSAGE_TYPES.SCREENSHOT_GET_ELEMENT_DETAILS,
      selector: options.selector,
    });

    const dpr = elementDetails.devicePixelRatio || pageDpr || 1;

    const cropRectPx = {
      x: elementDetails.rect.x * dpr,
      y: elementDetails.rect.y * dpr,
      width: elementDetails.rect.width * dpr,
      height: elementDetails.rect.height * dpr,
    };

    await new Promise((resolve) => setTimeout(resolve, SCREENSHOT_CONSTANTS.SCRIPT_INIT_DELAY));

    const visibleCaptureDataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
    if (!visibleCaptureDataUrl)
      throw new Error('Failed to capture visible tab for element cropping');

    const croppedCanvas = await cropAndResizeImage(
      visibleCaptureDataUrl,
      cropRectPx,
      dpr,
      options.width,
      options.height,
    );
    return canvasToDataURL(croppedCanvas);
  }

  async _captureFullPage(
    tabId: number,
    options: ScreenshotToolParams,
    initialPageDetails: any,
  ): Promise<string> {
    const dpr = initialPageDetails.devicePixelRatio;
    const totalWidthCss = options.width || initialPageDetails.totalWidth;
    const totalHeightCss = initialPageDetails.totalHeight;

    const maxHeightPx = options.maxHeight || SCREENSHOT_CONSTANTS.MAX_CAPTURE_HEIGHT_PX;
    const limitedHeightCss = Math.min(totalHeightCss, maxHeightPx / dpr);

    const totalWidthPx = totalWidthCss * dpr;
    const totalHeightPx = limitedHeightCss * dpr;

    const viewportHeightCss = initialPageDetails.viewportHeight;

    const capturedParts = [];
    let currentScrollYCss = 0;
    let capturedHeightPx = 0;
    let partIndex = 0;

    while (capturedHeightPx < totalHeightPx && partIndex < SCREENSHOT_CONSTANTS.MAX_CAPTURE_PARTS) {
      if (currentScrollYCss > 0) {
        const scrollResp = await this.sendMessageToTab(tabId, {
          action: TOOL_MESSAGE_TYPES.SCREENSHOT_SCROLL_PAGE,
          x: 0,
          y: currentScrollYCss,
          scrollDelay: SCREENSHOT_CONSTANTS.SCROLL_DELAY_MS,
        });
        currentScrollYCss = scrollResp.newScrollY;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, SCREENSHOT_CONSTANTS.CAPTURE_STITCH_DELAY_MS),
      );

      const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
      if (!dataUrl) throw new Error('captureVisibleTab returned empty during full page capture');

      const yOffsetPx = currentScrollYCss * dpr;
      capturedParts.push({ dataUrl, y: yOffsetPx });

      const imgForHeight = await createImageBitmapFromUrl(dataUrl);
      const lastPartEffectiveHeightPx = Math.min(imgForHeight.height, totalHeightPx - yOffsetPx);

      capturedHeightPx = yOffsetPx + lastPartEffectiveHeightPx;

      if (capturedHeightPx >= totalHeightPx - SCREENSHOT_CONSTANTS.PIXEL_TOLERANCE) break;

      currentScrollYCss += viewportHeightCss;
      if (
        currentScrollYCss > totalHeightCss - viewportHeightCss &&
        currentScrollYCss < totalHeightCss
      )
        currentScrollYCss = totalHeightCss - viewportHeightCss;

      partIndex++;
    }

    const finalCanvas = await stitchImages(capturedParts, totalWidthPx, totalHeightPx);

    let outputCanvas = finalCanvas;
    if (options.width && !options.height) {
      const targetWidthPx = options.width * dpr;
      const aspectRatio = finalCanvas.height / finalCanvas.width;
      const targetHeightPx = targetWidthPx * aspectRatio;
      outputCanvas = new OffscreenCanvas(targetWidthPx, targetHeightPx);
      const ctx = outputCanvas.getContext('2d');
      if (ctx)
        ctx.drawImage(finalCanvas, 0, 0, targetWidthPx, targetHeightPx);
    } else if (options.height && !options.width) {
      const targetHeightPx = options.height * dpr;
      const aspectRatio = finalCanvas.width / finalCanvas.height;
      const targetWidthPx = targetHeightPx * aspectRatio;
      outputCanvas = new OffscreenCanvas(targetWidthPx, targetHeightPx);
      const ctx = outputCanvas.getContext('2d');
      if (ctx)
        ctx.drawImage(finalCanvas, 0, 0, targetWidthPx, targetHeightPx);
    } else if (options.width && options.height) {
      const targetWidthPx = options.width * dpr;
      const targetHeightPx = options.height * dpr;
      outputCanvas = new OffscreenCanvas(targetWidthPx, targetHeightPx);
      const ctx = outputCanvas.getContext('2d');
      if (ctx)
        ctx.drawImage(finalCanvas, 0, 0, targetWidthPx, targetHeightPx);
    }

    return canvasToDataURL(outputCanvas);
  }
}

export const screenshotTool = new ScreenshotTool();
