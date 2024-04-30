import { format } from "date-fns";

export function formatDateAndTime(date: Date): string {
  return format(date, "dd/MM/yyyy HH:mm:ss");
}
