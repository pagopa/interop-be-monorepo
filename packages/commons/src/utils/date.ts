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
 * Normalizes a Unix timestamp expressed in seconds, milliseconds, microseconds
 * or nanoseconds (decimals allowed) to integer milliseconds.
 * Values >= 1e10 cannot be seconds (they would be dates after year 2286), so
 * the value is divided by 1000 until it falls in the seconds range; the
 * s/ms/µs/ns representations of dates between 2001 and 2286 lie in disjoint
 * ranges, so no realistic timestamp is ambiguous.
 */
export const timestampToMilliseconds = (timestamp: number): number => {
  if (!Number.isFinite(timestamp)) {
    return timestamp;
  }
  return timestamp >= 1e10
    ? timestampToMilliseconds(timestamp / 1000)
    : Math.round(timestamp * 1000);
};
