/**
 * Current-date helpers for calendar-aware mock data.
 * Use for MTD spend, days remaining, and progressive display values.
 */

export const TODAY = new Date();

export const DAYS_ELAPSED = TODAY.getDate();

export const DAYS_IN_MONTH = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate();

export const DAYS_REMAINING = Math.max(0, DAYS_IN_MONTH - DAYS_ELAPSED);
