/**
 * Mock API Access Tokens Data
 *
 * Personal, service, and MCP tokens.
 * Used in: Settings > API Access Tokens
 */

import { overviewSummary } from "./mockOverview";

/** Personal access tokens (empty by default) */
export const personalTokens = [];

/** Service tokens (optional, for future use) */
export const serviceTokens = [];

/** MCP server token (optional) */
export const mcpToken = null;

export const lastUpdated = overviewSummary.lastUpdated;
