import { format } from "date-fns";

export function formatClonedEServiceDate(date: Date): string {
  return format(date, "dd/MM/yyyy HH:mm:ss");
}
