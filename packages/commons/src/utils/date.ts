import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export function formatDateddMMyyyyHHmmss(date: Date): string {
  return format(date, "dd/MM/yyyy HH:mm:ss");
}

export function formatDateyyyyMMddHHmmss(date: Date): string {
  return format(date, "yyyyMMddHHmmss");
}

export function formatDateyyyyMMddTHHmmss(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

export function formatDateyyyyMMdd(date: Date): string {
  return format(date, "yyyyMMdd");
}

export function formatTimeHHmmss(date: Date): string {
  return format(date, "HHmmss");
}

export function dateAtRomeZone(date: Date): string {
  return formatInTimeZone(date, "Europe/Rome", "dd/MM/yyyy");
}

export function timeAtRomeZone(date: Date): string {
  return formatInTimeZone(date, "Europe/Rome", "HH:mm:ss");
}

export function dateToSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Normalizes a Unix timestamp in seconds, milliseconds, microseconds or
 * nanoseconds (decimals allowed) to integer milliseconds. Unambiguous because
 * the s/ms/µs/ns forms of any date between 2001 and 2286 lie in disjoint
 * ranges; anything below 1e10 reads as seconds, so this is for token
 * timestamps, which fall in that window.
 */
export const timestampToMilliseconds = (timestamp: number): number => {
  if (!Number.isFinite(timestamp)) {
    return timestamp;
  }
  return timestamp >= 1e10
    ? timestampToMilliseconds(timestamp / 1000)
    : Math.round(timestamp * 1000);
};
