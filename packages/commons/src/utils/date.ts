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

export const secondsToMilliseconds = (timestamp: number): number => {
  if (timestamp.toString().length === 10) {
    return timestamp * 1000;
  }
  return timestamp;
};
