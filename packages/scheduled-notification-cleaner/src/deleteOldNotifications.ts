import { lt, or } from "drizzle-orm";
import { Logger } from "pagopa-interop-commons";
import { scheduledNotification } from "pagopa-interop-scheduled-notification-db-models";
import { DrizzleReturnType } from "pagopa-interop-readmodel-models";

export const deleteOldNotifications = async (
  db: DrizzleReturnType,
  deleteOlderThanDays: number,
  loggerInstance: Logger
): Promise<number> => {
  const cutoffDate = new Date(
    Date.now() - deleteOlderThanDays * 24 * 60 * 60 * 1000
  );

  loggerInstance.info(
    `Deleting notifications older than ${deleteOlderThanDays} days (cutoff: ${cutoffDate.toISOString()})`
  );

  const condition = or(
    lt(scheduledNotification.sentAt, cutoffDate),
    lt(scheduledNotification.skippedAt, cutoffDate)
  );

  const result = await db.delete(scheduledNotification).where(condition);

  const deletedCount = result.rowCount ?? 0;

  loggerInstance.info(
    `Successfully deleted ${deletedCount} notifications older than ${cutoffDate.toISOString()}`
  );

  return deletedCount;
};
