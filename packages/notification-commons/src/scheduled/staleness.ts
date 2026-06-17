import { differenceInHours } from "date-fns";

export const isStale = (
  sendAt: Date,
  thresholdHours: number,
  now: Date = new Date()
): boolean => differenceInHours(now, sendAt) > thresholdHours;
