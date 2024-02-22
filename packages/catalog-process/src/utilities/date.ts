import { format } from "date-fns";

export function formatClonedEServiceDate(date: Date): string {
  return format(date, "MM/dd/yyyy HH:mm:ss");
}
