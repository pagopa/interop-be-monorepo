import { lt } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Logger } from "pagopa-interop-commons";
import {
  agreementInM2MEvent,
  attributeInM2MEvent,
  clientInM2MEvent,
  consumerDelegationInM2MEvent,
  eserviceInM2MEvent,
  eserviceTemplateInM2MEvent,
  keyInM2MEvent,
  producerDelegationInM2MEvent,
  producerKeyInM2MEvent,
  producerKeychainInM2MEvent,
  purposeInM2MEvent,
  tenantInM2MEvent,
  purposeTemplateInM2MEvent,
} from "pagopa-interop-m2m-event-db-models";

export const deleteOldM2MEvents = async (
  db: NodePgDatabase,
  deleteOlderThanDays: number,
  loggerInstance: Logger
): Promise<number> => {
  const cutoffDate = new Date(
    Date.now() - deleteOlderThanDays * 24 * 60 * 60 * 1000
  );

  loggerInstance.info(
    `Deleting events older than ${deleteOlderThanDays} days (cutoff: ${cutoffDate.toISOString()})`
  );

  const m2mEventDbs = [
    ["agreement", agreementInM2MEvent],
    ["attribute", attributeInM2MEvent],
    ["client", clientInM2MEvent],
    ["consumerDelegation", consumerDelegationInM2MEvent],
    ["eservice", eserviceInM2MEvent],
    ["eserviceTemplate", eserviceTemplateInM2MEvent],
    ["key", keyInM2MEvent],
    ["producerDelegation", producerDelegationInM2MEvent],
    ["producerKey", producerKeyInM2MEvent],
    ["producerKeychain", producerKeychainInM2MEvent],
    ["purpose", purposeInM2MEvent],
    ["purposeTemplate", purposeTemplateInM2MEvent],
    ["tenant", tenantInM2MEvent],
  ] as const;

  // eslint-disable-next-line functional/no-let
  let totalDeleted = 0;

  for (const [tableName, m2mEventDbTable] of m2mEventDbs) {
    const result = await db
      .delete(m2mEventDbTable)
      .where(lt(m2mEventDbTable.eventTimestamp, cutoffDate.toISOString()));

    const deletedCount = result.rowCount ?? 0;

    loggerInstance.info(
      `Successfully deleted ${deletedCount} events from table ${tableName}`
    );

    totalDeleted += deletedCount;
  }

  loggerInstance.info(`Total deleted events: ${totalDeleted}`);
  return totalDeleted;
};
