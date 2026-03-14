import { createErrorResponse, ToolResult } from './types';
import { BaseBrowserToolExecutor } from './base-browser';
import { TOOL_NAMES } from './names';

interface BookmarkSearchToolParams {
  query?: string;
  maxResults?: number;
  folderPath?: string;
}

interface BookmarkAddToolParams {
  url?: string;
  title?: string;
  parentId?: string;
  createFolder?: boolean;
}

interface BookmarkDeleteToolParams {
  bookmarkId?: string;
  url?: string;
  title?: string;
}

async function getBookmarkFolderPath(bookmarkNodeId: string): Promise<string> {
  const pathParts: string[] = [];
  try {
    const initialNodes = await chrome.bookmarks.get(bookmarkNodeId);
    if (initialNodes.length > 0 && initialNodes[0]) {
      let pathNodeId = initialNodes[0].parentId;
      while (pathNodeId) {
        const parentNodes = await chrome.bookmarks.get(pathNodeId);
        if (parentNodes.length === 0) break;
        const parentNode = parentNodes[0];
        if (parentNode.title) pathParts.unshift(parentNode.title);
        if (!parentNode.parentId) break;
        pathNodeId = parentNode.parentId;
      }
    }
  } catch (error) {
    console.error(`Error getting bookmark path for node ID ${bookmarkNodeId}:`, error);
    return pathParts.join(' > ') || 'Error getting path';
  }
  return pathParts.join(' > ');
}

async function findFolderByPathOrId(
  pathOrId: string,
): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  try {
    const nodes = await chrome.bookmarks.get(pathOrId);
    if (nodes && nodes.length > 0 && !nodes[0].url) return nodes[0];
  } catch {
    // try path parsing
  }

  const pathParts = pathOrId.split('/').map((p) => p.trim()).filter((p) => p.length > 0);
  if (pathParts.length === 0) return null;

  const rootChildren = await chrome.bookmarks.getChildren('0');
  let currentNodes = rootChildren;
  let foundFolder: chrome.bookmarks.BookmarkTreeNode | null = null;

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    foundFolder = null;
    let matched: chrome.bookmarks.BookmarkTreeNode | null = null;

    for (const node of currentNodes) {
      if (!node.url && node.title.toLowerCase() === part.toLowerCase()) {
        matched = node;
        break;
      }
    }

    if (matched) {
      if (i === pathParts.length - 1)
        foundFolder = matched;
      else
        currentNodes = await chrome.bookmarks.getChildren(matched.id);
    } else {
      return null;
    }
  }

  return foundFolder;
}

async function createFolderPath(
  folderPath: string,
  parentId?: string,
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const pathParts = folderPath.split('/').map((p) => p.trim()).filter((p) => p.length > 0);
  if (pathParts.length === 0) throw new Error('Folder path cannot be empty');

  let currentParentId: string = parentId || '';
  if (!currentParentId) {
    const rootChildren = await chrome.bookmarks.getChildren('0');
    const bookmarkBarFolder = rootChildren.find(
      (node) =>
        !node.url &&
        (node.title === 'Bookmarks bar' || node.title === 'Bookmarks Bar'),
    );
    currentParentId = bookmarkBarFolder?.id || '1';
  }

  let currentFolder: chrome.bookmarks.BookmarkTreeNode | null = null;

  for (const folderName of pathParts) {
    const children = await chrome.bookmarks.getChildren(currentParentId);
    const existing = children.find(
      (child) => !child.url && child.title.toLowerCase() === folderName.toLowerCase(),
    );

    if (existing) {
      currentFolder = existing;
      currentParentId = existing.id;
    } else {
      currentFolder = await chrome.bookmarks.create({
        parentId: currentParentId,
        title: folderName,
      });
      currentParentId = currentFolder.id;
    }
  }

  if (!currentFolder) throw new Error('Failed to create folder path');
  return currentFolder;
}

function flattenBookmarkNodesToBookmarks(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
): chrome.bookmarks.BookmarkTreeNode[] {
  const result: chrome.bookmarks.BookmarkTreeNode[] = [];
  const stack = [...nodes];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node.url) result.push(node);
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--)
        stack.push(node.children[i]);
    }
  }

  return result;
}

async function findBookmarksByUrl(
  url: string,
  title?: string,
): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  const searchResults = await chrome.bookmarks.search({ url });
  if (!title) return searchResults;

  const titleLower = title.toLowerCase();
  return searchResults.filter(
    (bookmark) => bookmark.title && bookmark.title.toLowerCase().includes(titleLower),
  );
}

class BookmarkSearchTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BOOKMARK_SEARCH;

  async execute(args: BookmarkSearchToolParams): Promise<ToolResult> {
    const { query = '', maxResults = 50, folderPath } = args;

    try {
      let bookmarksToSearch: chrome.bookmarks.BookmarkTreeNode[] = [];
      let targetFolderNode: chrome.bookmarks.BookmarkTreeNode | null = null;

      if (folderPath) {
        targetFolderNode = await findFolderByPathOrId(folderPath);
        if (!targetFolderNode)
          return createErrorResponse(`Specified folder not found: "${folderPath}"`);
        const subTree = await chrome.bookmarks.getSubTree(targetFolderNode.id);
        bookmarksToSearch =
          subTree.length > 0 ? flattenBookmarkNodesToBookmarks(subTree[0].children || []) : [];
      }

      let filteredBookmarks: chrome.bookmarks.BookmarkTreeNode[];

      if (query) {
        if (targetFolderNode) {
          const lowerCaseQuery = query.toLowerCase();
          filteredBookmarks = bookmarksToSearch.filter(
            (bookmark) =>
              (bookmark.title && bookmark.title.toLowerCase().includes(lowerCaseQuery)) ||
              (bookmark.url && bookmark.url.toLowerCase().includes(lowerCaseQuery)),
          );
        } else {
          filteredBookmarks = await chrome.bookmarks.search({ query });
          filteredBookmarks = filteredBookmarks.filter((item) => !!item.url);
        }
      } else {
        if (!targetFolderNode) {
          const tree = await chrome.bookmarks.getTree();
          bookmarksToSearch = flattenBookmarkNodesToBookmarks(tree);
        }
        filteredBookmarks = bookmarksToSearch;
      }

      const limitedResults = filteredBookmarks.slice(0, maxResults);

      const resultsWithPath = await Promise.all(
        limitedResults.map(async (bookmark) => {
          const path = await getBookmarkFolderPath(bookmark.id);
          return {
            id: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            dateAdded: bookmark.dateAdded,
            folderPath: path,
          };
        }),
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              totalResults: resultsWithPath.length,
              query: query || null,
              folderSearched: targetFolderNode
                ? targetFolderNode.title || targetFolderNode.id
                : 'All bookmarks',
              bookmarks: resultsWithPath,
            }, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `Error searching bookmarks: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

class BookmarkAddTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BOOKMARK_ADD;

  async execute(args: BookmarkAddToolParams): Promise<ToolResult> {
    const { url, title, parentId, createFolder = false } = args;

    try {
      let bookmarkUrl = url;
      let bookmarkTitle = title;

      if (!bookmarkUrl) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0] || !tabs[0].url)
          return createErrorResponse('No active tab with valid URL found, and no URL provided');

        bookmarkUrl = tabs[0].url;
        if (!bookmarkTitle) bookmarkTitle = tabs[0].title || bookmarkUrl;
      }

      if (!bookmarkUrl) return createErrorResponse('URL is required to create bookmark');

      let actualParentId: string | undefined = undefined;
      if (parentId) {
        let folderNode = await findFolderByPathOrId(parentId);

        if (!folderNode && createFolder) {
          try {
            folderNode = await createFolderPath(parentId);
          } catch (createError) {
            return createErrorResponse(
              `Failed to create folder path: ${createError instanceof Error ? createError.message : String(createError)}`,
            );
          }
        }

        if (folderNode) {
          actualParentId = folderNode.id;
        } else {
          try {
            const nodes = await chrome.bookmarks.get(parentId);
            if (nodes && nodes.length > 0 && !nodes[0].url)
              actualParentId = nodes[0].id;
            else
              return createErrorResponse(
                `Specified parent folder (ID/path: "${parentId}") not found or is not a folder${createFolder ? ', and creation failed' : '. You can set createFolder=true to auto-create folders'}`,
              );
          } catch {
            return createErrorResponse(
              `Specified parent folder (ID/path: "${parentId}") not found or invalid${createFolder ? ', and creation failed' : '. You can set createFolder=true to auto-create folders'}`,
            );
          }
        }
      } else {
        const rootChildren = await chrome.bookmarks.getChildren('0');
        const bookmarkBarFolder = rootChildren.find(
          (node) =>
            !node.url &&
            (node.title === 'Bookmarks bar' || node.title === 'Bookmarks Bar'),
        );
        actualParentId = bookmarkBarFolder?.id || '1';
      }

      const newBookmark = await chrome.bookmarks.create({
        parentId: actualParentId,
        title: bookmarkTitle || bookmarkUrl,
        url: bookmarkUrl,
      });

      const path = await getBookmarkFolderPath(newBookmark.id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Bookmark added successfully',
              bookmark: {
                id: newBookmark.id,
                title: newBookmark.title,
                url: newBookmark.url,
                dateAdded: newBookmark.dateAdded,
                folderPath: path,
              },
              folderCreated: createFolder && parentId ? 'Folder created if necessary' : false,
            }, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Can't bookmark URLs of type"))
        return createErrorResponse(
          `Error adding bookmark: Cannot bookmark this type of URL (e.g., chrome:// system pages). ${errorMessage}`,
        );
      return createErrorResponse(`Error adding bookmark: ${errorMessage}`);
    }
  }
}

class BookmarkDeleteTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BOOKMARK_DELETE;

  async execute(args: BookmarkDeleteToolParams): Promise<ToolResult> {
    const { bookmarkId, url, title } = args;

    if (!bookmarkId && !url)
      return createErrorResponse('Must provide bookmark ID or URL to delete bookmark');

    try {
      let bookmarksToDelete: chrome.bookmarks.BookmarkTreeNode[] = [];

      if (bookmarkId) {
        try {
          const nodes = await chrome.bookmarks.get(bookmarkId);
          if (nodes && nodes.length > 0 && nodes[0].url)
            bookmarksToDelete = nodes;
          else
            return createErrorResponse(
              `Bookmark with ID "${bookmarkId}" not found, or the ID does not correspond to a bookmark`,
            );
        } catch {
          return createErrorResponse(`Invalid bookmark ID: "${bookmarkId}"`);
        }
      } else if (url) {
        bookmarksToDelete = await findBookmarksByUrl(url, title);
        if (bookmarksToDelete.length === 0)
          return createErrorResponse(
            `No bookmark found with URL "${url}"${title ? ` (title contains: "${title}")` : ''}`,
          );
      }

      const deletedBookmarks = [];
      const errors = [];

      for (const bookmark of bookmarksToDelete) {
        try {
          const path = await getBookmarkFolderPath(bookmark.id);
          await chrome.bookmarks.remove(bookmark.id);
          deletedBookmarks.push({
            id: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            folderPath: path,
          });
        } catch (error) {
          errors.push(
            `Failed to delete bookmark "${bookmark.title}" (ID: ${bookmark.id}): ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (deletedBookmarks.length === 0)
        return createErrorResponse(`Failed to delete bookmarks: ${errors.join('; ')}`);

      const result: any = {
        success: true,
        message: `Successfully deleted ${deletedBookmarks.length} bookmark(s)`,
        deletedBookmarks,
      };

      if (errors.length > 0) {
        result.partialSuccess = true;
        result.errors = errors;
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `Error deleting bookmark: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const bookmarkSearchTool = new BookmarkSearchTool();
export const bookmarkAddTool = new BookmarkAddTool();
export const bookmarkDeleteTool = new BookmarkDeleteTool();
