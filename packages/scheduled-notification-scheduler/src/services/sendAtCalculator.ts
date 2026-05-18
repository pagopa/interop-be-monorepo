import { set, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type ComputeSendAtParams = {
  archivableOn: Date;
  daysBeforeArchive: number;
  sendAtHour: number;
  tz: string;
};

/**
 * Compute the UTC instant at which a reminder should be delivered.
 *
 * `archivableOn` is the UTC timestamp when the archive cronjob will run
 * (midnight UTC of the target day, per `catalog-process` convention).
 * We want the reminder to fire `daysBeforeArchive` days earlier, at a
 * fixed local hour (`sendAtHour`) in the given timezone.
 *
 * The implementation is intentionally pure and DST-safe: we project
 * `archivableOn` into the target timezone, subtract the wall-clock days,
 * set the hour, and then translate back to UTC.
 */
export const computeSendAt = ({
  archivableOn,
  daysBeforeArchive,
  sendAtHour,
  tz,
}: ComputeSendAtParams): Date => {
  const zoned = toZonedTime(archivableOn, tz);
  const zonedShifted = subDays(zoned, daysBeforeArchive);
  const zonedAtHour = set(zonedShifted, {
    hours: sendAtHour,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });
  return fromZonedTime(zonedAtHour, tz);
};
