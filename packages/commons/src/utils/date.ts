import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export function formatDateddMMyyyyHHmmss(date: Date): string {
  return format(date, "dd/MM/yyyy HH:mm:ss");
}

export function formatDateyyyyMMddHHmmss(date: Date): string {
  return format(date, "yyyyMMddHHmmss");
}

export function formatDateyyyyMMddThhmmss(date: Date): string {
  return format(date, "yyyy-MM-dd'T'hh:mm:ss");
}

export function formatDateyyyyMMdd(date: Date): string {
  return format(date, "yyyyMMdd");
}

export function formatTimehhmmss(date: Date): string {
  return format(date, "hhmmss");
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

export const timestampToMilliseconds = (timestamp: number): number => {
  const truncatedTimestamp = Math.trunc(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const ratio = truncatedTimestamp / nowSeconds;

  if (ratio > 1_000_000) {
    // nanoseconds -> milliseconds
    return Math.trunc(truncatedTimestamp / 1_000_000);
  } else if (ratio > 1_000) {
    // microseconds -> milliseconds
    return Math.trunc(truncatedTimestamp / 1_000);
  } else if (ratio > 1) {
    // milliseconds
    return truncatedTimestamp;
  } else {
    // seconds -> milliseconds
    return truncatedTimestamp * 1_000;
  }
};
