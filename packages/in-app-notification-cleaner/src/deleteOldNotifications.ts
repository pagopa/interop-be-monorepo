import { lt } from "drizzle-orm";
import { Logger } from "pagopa-interop-commons";
import { notification } from "pagopa-interop-in-app-notification-db-models";
import { DrizzleReturnType } from "pagopa-interop-readmodel-models";

export const deleteOldNotifications = async (
  db: DrizzleReturnType,
  deleteOlderThanDays: number,
  loggerInstance: Logger
): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - deleteOlderThanDays);

  loggerInstance.info(
    `Deleting notifications older than ${deleteOlderThanDays} days (cutoff: ${cutoffDate.toISOString()})`
  );

  const result = await db
    .delete(notification)
    .where(lt(notification.createdAt, cutoffDate.toISOString()));

  const deletedCount = result.rowCount ?? 0;

  loggerInstance.info(
    `Successfully deleted ${deletedCount} notifications older than ${cutoffDate.toISOString()}`
  );

  return deletedCount;
};
