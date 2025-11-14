import { SQL, and, eq } from "drizzle-orm";
import { AnyPgTable } from "drizzle-orm/pg-core";
import {
  eserviceInM2MEvent,
  agreementInM2MEvent,
  attributeInM2MEvent,
  purposeInM2MEvent,
} from "pagopa-interop-m2m-event-db-models";
import { genericInternalError } from "pagopa-interop-models";
import { DrizzleTransactionType } from "pagopa-interop-readmodel-models";

export async function isResourceVersionPresent<
  T extends
    | typeof attributeInM2MEvent
    | typeof eserviceInM2MEvent
    | typeof agreementInM2MEvent
    | typeof purposeInM2MEvent
>(
  tx: DrizzleTransactionType,
  resourceVersion: number,
  table: T,
  resourceIdFilter: SQL | undefined
): Promise<boolean> {
  if (resourceIdFilter === undefined) {
    throw genericInternalError("Filter cannot be undefined");
  }

  const row = await tx
    .select({
      resourceVersion: table.resourceVersion,
    })
    .from(table satisfies AnyPgTable)
    .where(and(resourceIdFilter, eq(table.resourceVersion, resourceVersion)))
    .limit(1);

  const existingResourceVersion = row.at(0)?.resourceVersion;

  return existingResourceVersion !== undefined;
}
