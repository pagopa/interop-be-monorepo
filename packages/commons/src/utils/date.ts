import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export function formatDateddMMyyyyHHmmss(date: Date): string {
  return format(date, "dd/MM/yyyy HH:mm:ss");
}

export function formatDateyyyyMMddHHmmss(date: Date): string {
  return format(date, "yyyyMMddHHmmss");
}

export function dateAtRomeZone(date: Date): string {
  return formatInTimeZone(date, "Europe/Rome", "dd/MM/yyyy");
}

export function timeAtRomeZone(date: Date): string {
  return formatInTimeZone(date, "Europe/Rome", "HH:mm:ss");
}
