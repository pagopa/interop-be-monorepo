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
  // ns -> ms
  if (timestamp > 1e17) {
    return Math.trunc(timestamp / 1_000_000);
  }
  // µs -> ms
  if (timestamp > 1e14) {
    return Math.trunc(timestamp / 1_000);
  }
  // ms -> ms
  if (timestamp > 1e12) {
    return Math.trunc(timestamp);
  }
  // s -> ms
  return Math.trunc(timestamp * 1_000);
};
