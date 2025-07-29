/* eslint-disable functional/immutable-data */
import { format } from "date-fns";
import { BaseEventData } from "../models/eventTypes.js";

export function formatTimehhmmss(date: Date): string {
  return format(date, "hhmmss");
}

/**
 * Groups events by UTC date (YYYY-MM-DD) using a provided function to extract the timestamp.
 *
 * @param events - Array of event objects.
 * @param timestampExtractor - A function that takes an event object and returns its timestamp (number or Date).
 * @returns A Map where each key is a date string (YYYY-MM-DD) and the value is an array of the events.
 */
export function groupEventsByDate<T extends BaseEventData>(
  events: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const event of events) {
    const date = new Date(event.eventTimestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const key = `${year}-${month}-${day}`;

    const existing = grouped.get(key) ?? [];
    grouped.set(key, [...existing, event]);
  }

  return grouped;
}
