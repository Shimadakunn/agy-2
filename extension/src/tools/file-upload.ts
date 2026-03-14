import { createErrorResponse, ToolResult } from './types';
import { BaseBrowserToolExecutor } from './base-browser';
import { TOOL_NAMES } from './names';
import { cdpSessionManager } from '../utils/cdp-session-manager';

interface FileUploadToolParams {
  selector: string;
  filePath?: string;
  fileUrl?: string;
  base64Data?: string;
  fileName?: string;
  multiple?: boolean;
  tabId?: number;
  windowId?: number;
}

class FileUploadTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.FILE_UPLOAD;

  async execute(args: FileUploadToolParams): Promise<ToolResult> {
    const { selector, filePath, fileUrl, base64Data, fileName, multiple = false } = args;

    console.log(`Starting file upload operation with options:`, args);

    if (!selector)
      return createErrorResponse('Selector is required for file upload');

    if (!filePath && !fileUrl && !base64Data)
      return createErrorResponse('One of filePath, fileUrl, or base64Data must be provided');

    try {
      const explicit = await this.tryGetTab(args.tabId);
      const tab = explicit || (await this.getActiveTabOrThrowInWindow(args.windowId));
      if (!tab.id) return createErrorResponse('No active tab found');
      const tabId = tab.id;

      let files: string[] = [];

      if (filePath) {
        files = [filePath];
      } else if (fileUrl || base64Data) {
        const tempFilePath = await this.prepareFileFromRemote({
          fileUrl,
          base64Data,
          fileName: fileName || 'uploaded-file',
        });
        if (!tempFilePath)
          return createErrorResponse('Failed to prepare file for upload');
        files = [tempFilePath];
      }

      await cdpSessionManager.withSession(tabId, 'file-upload', async () => {
        await cdpSessionManager.sendCommand(tabId, 'DOM.enable', {});
        await cdpSessionManager.sendCommand(tabId, 'Runtime.enable', {});

        const { root } = (await cdpSessionManager.sendCommand(tabId, 'DOM.getDocument', {
          depth: -1,
          pierce: true,
        })) as { root: { nodeId: number } };

        const { nodeId } = (await cdpSessionManager.sendCommand(tabId, 'DOM.querySelector', {
          nodeId: root.nodeId,
          selector: selector,
        })) as { nodeId: number };

        if (!nodeId || nodeId === 0)
          throw new Error(`Element with selector "${selector}" not found`);

        const { node } = (await cdpSessionManager.sendCommand(tabId, 'DOM.describeNode', {
          nodeId,
        })) as { node: { nodeName: string; attributes?: string[] } };

        if (node.nodeName !== 'INPUT')
          throw new Error(`Element with selector "${selector}" is not an input element`);

        const attributes = node.attributes || [];
        let isFileInput = false;
        for (let i = 0; i < attributes.length; i += 2) {
          if (attributes[i] === 'type' && attributes[i + 1] === 'file') {
            isFileInput = true;
            break;
          }
        }

        if (!isFileInput)
          throw new Error(`Element with selector "${selector}" is not a file input (type="file")`);

        await cdpSessionManager.sendCommand(tabId, 'DOM.setFileInputFiles', {
          nodeId,
          files,
        });

        await cdpSessionManager.sendCommand(tabId, 'Runtime.evaluate', {
          expression: `
            (function() {
              const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
              if (element) {
                const event = new Event('change', { bubbles: true });
                element.dispatchEvent(event);
                return true;
              }
              return false;
            })()
          `,
        });
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'File(s) uploaded successfully',
              files: files,
              selector: selector,
              fileCount: files.length,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in file upload operation:', error);
      return createErrorResponse(
        `Error uploading file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async prepareFileFromRemote(options: {
    fileUrl?: string;
    base64Data?: string;
    fileName: string;
  }): Promise<string | null> {
    const { fileUrl, base64Data, fileName } = options;

    return new Promise((resolve) => {
      const requestId = `file-upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timeout = setTimeout(() => {
        console.error('File preparation request timed out');
        resolve(null);
      }, 30000);

      const handleMessage = (message: any) => {
        if (
          message.type === 'file_operation_response' &&
          message.responseToRequestId === requestId
        ) {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(handleMessage);

          if (message.payload?.success && message.payload?.filePath)
            resolve(message.payload.filePath);
          else {
            console.error(
              'Native host failed to prepare file:',
              message.error || message.payload?.error,
            );
            resolve(null);
          }
        }
      };

      chrome.runtime.onMessage.addListener(handleMessage);

      chrome.runtime
        .sendMessage({
          type: 'forward_to_native',
          message: {
            type: 'file_operation',
            requestId: requestId,
            payload: {
              action: 'prepareFile',
              fileUrl,
              base64Data,
              fileName,
            },
          },
        })
        .catch((error) => {
          console.error('Error sending message to background:', error);
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(handleMessage);
          resolve(null);
        });
    });
  }
}

export const fileUploadTool = new FileUploadTool();
