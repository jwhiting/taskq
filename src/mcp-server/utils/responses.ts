import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Create a successful text response for MCP tools
 */
export function createTextResponse(text: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

/**
 * Create a successful JSON response for MCP tools
 */
export function createJsonResponse(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Create an error response for MCP tools
 */
export function createErrorResponse(error: Error | string): CallToolResult {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [
      {
        type: "text",
        text: `Error: ${message}`,
      },
    ],
    isError: true,
  };
}

/**
 * Format table data as ASCII table for MCP text response
 */
export function formatTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return `No data found.\n\nColumns: ${headers.join(", ")}`;
  }

  // Calculate column widths
  const widths = headers.map((header, i) => {
    const maxDataWidth = Math.max(...rows.map((row) => String(row[i] || "").length));
    return Math.max(header.length, maxDataWidth);
  });

  // Create separator
  const separator = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";

  // Create header row
  const headerRow =
    "|" +
    headers
      .map((header, i) => ` ${header.padEnd(widths[i] || 0)} `)
      .join("|") +
    "|";

  // Create data rows
  const dataRows = rows.map(
    (row) =>
      "|" +
      row
        .map((cell, i) => ` ${String(cell || "").padEnd(widths[i] || 0)} `)
        .join("|") +
      "|"
  );

  return [separator, headerRow, separator, ...dataRows, separator].join("\n");
}