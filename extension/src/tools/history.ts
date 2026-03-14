import { createErrorResponse, ToolResult } from './types';
import { BaseBrowserToolExecutor } from './base-browser';
import { TOOL_NAMES } from './names';

interface HistoryToolParams {
  text?: string;
  startTime?: string;
  endTime?: string;
  maxResults?: number;
  excludeCurrentTabs?: boolean;
}

interface HistoryItem {
  id: string;
  url?: string;
  title?: string;
  lastVisitTime?: number;
  visitCount?: number;
  typedCount?: number;
}

interface HistoryResult {
  items: HistoryItem[];
  totalCount: number;
  timeRange: {
    startTime: number;
    endTime: number;
    startTimeFormatted: string;
    endTimeFormatted: string;
  };
  query?: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function parseDateString(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;

  const now = new Date();
  const lower = dateStr.toLowerCase().trim();

  if (lower === 'now') return now.getTime();
  if (lower === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (lower === 'yesterday')
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();

  const relativeMatch = lower.match(
    /^(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago$/,
  );
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const d = new Date(now);
    if (unit.startsWith('day')) d.setDate(d.getDate() - amount);
    else if (unit.startsWith('week')) d.setDate(d.getDate() - amount * 7);
    else if (unit.startsWith('month')) d.setMonth(d.getMonth() - amount);
    else if (unit.startsWith('year')) d.setFullYear(d.getFullYear() - amount);
    else return null;
    return d.getTime();
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.getTime();

  return null;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

class HistoryTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.HISTORY;

  async execute(args: HistoryToolParams): Promise<ToolResult> {
    try {
      const { text = '', maxResults = 100, excludeCurrentTabs = false } = args;

      const now = Date.now();
      let startTimeMs: number;
      let endTimeMs: number;

      if (args.startTime) {
        const parsed = parseDateString(args.startTime);
        if (parsed === null)
          return createErrorResponse(
            `Invalid format for start time: "${args.startTime}". Supported formats: ISO (YYYY-MM-DD), "today", "yesterday", "X days/weeks/months/years ago".`,
          );
        startTimeMs = parsed;
      } else {
        startTimeMs = now - ONE_DAY_MS;
      }

      if (args.endTime) {
        const parsed = parseDateString(args.endTime);
        if (parsed === null)
          return createErrorResponse(
            `Invalid format for end time: "${args.endTime}". Supported formats: ISO (YYYY-MM-DD), "today", "yesterday", "X days/weeks/months/years ago".`,
          );
        endTimeMs = parsed;
      } else {
        endTimeMs = now;
      }

      if (startTimeMs > endTimeMs)
        return createErrorResponse('Start time cannot be after end time.');

      const historyItems = await chrome.history.search({
        text,
        startTime: startTimeMs,
        endTime: endTimeMs,
        maxResults,
      });

      let filteredItems = historyItems;
      if (excludeCurrentTabs && historyItems.length > 0) {
        const currentTabs = await chrome.tabs.query({});
        const openUrls = new Set<string>();
        currentTabs.forEach((tab) => {
          if (tab.url) openUrls.add(tab.url);
        });

        if (openUrls.size > 0)
          filteredItems = historyItems.filter((item) => !(item.url && openUrls.has(item.url)));
      }

      const result: HistoryResult = {
        items: filteredItems.map((item) => ({
          id: item.id,
          url: item.url,
          title: item.title,
          lastVisitTime: item.lastVisitTime,
          visitCount: item.visitCount,
          typedCount: item.typedCount,
        })),
        totalCount: filteredItems.length,
        timeRange: {
          startTime: startTimeMs,
          endTime: endTimeMs,
          startTimeFormatted: formatDate(startTimeMs),
          endTimeFormatted: formatDate(endTimeMs),
        },
      };

      if (text) result.query = text;

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `Error retrieving browsing history: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const historyTool = new HistoryTool();
