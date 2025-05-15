/* eslint-disable functional/immutable-data */
import {
  fromTenantV1,
  genericInternalError,
  TenantEventEnvelopeV1,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  TenantItemsSQL,
  TenantSQL,
  TenantMailSQL,
} from "pagopa-interop-readmodel-models";
import { splitTenantIntoObjectsSQL } from "pagopa-interop-readmodel";
import { DBContext } from "../../db/db.js";
import { tenantServiceBuilder } from "../../service/tenantService.js";

export async function handleTenantMessageV1(
  messages: TenantEventEnvelopeV1[],
  dbContext: DBContext
): Promise<void> {
  const tenantService = tenantServiceBuilder(dbContext);

  const upsertTenantBatch: TenantItemsSQL[] = [];
  const deleteTenantBatch: Array<TenantSQL["id"]> = [];
  const deleteTenantMailBatch: Array<Pick<TenantMailSQL, "id" | "tenantId">> =
    [];
  const upsertTenantSelfcareIdBatch: Array<
    Pick<TenantSQL, "id" | "selfcareId" | "metadataVersion">
  > = [];

  for (const message of messages) {
    await match(message)
      .with(
        {
          type: P.union("TenantCreated", "TenantUpdated", "TenantMailAdded"),
        },
        (msg) => {
          if (!msg.data.tenant) {
            throw genericInternalError("Tenant not found in message");
          }

          const splitResult: TenantItemsSQL = splitTenantIntoObjectsSQL(
            fromTenantV1(msg.data.tenant),
            message.version
          );

          upsertTenantBatch.push(splitResult);
        }
      )
      .with({ type: "TenantDeleted" }, (msg) => {
        deleteTenantBatch.push(msg.data.tenantId);
      })
      .with({ type: "TenantMailDeleted" }, (msg) => {
        deleteTenantMailBatch.push({
          id: msg.data.mailId,
          tenantId: msg.data.tenantId,
        });
      })
      .with(
        {
          type: "SelfcareMappingCreated",
        },
        (msg) => {
          upsertTenantSelfcareIdBatch.push({
            id: msg.data.tenantId,
            selfcareId: msg.data.selfcareId,
            metadataVersion: msg.version,
          });
        }
      )
      .with({ type: "SelfcareMappingDeleted" }, () => Promise.resolve())
      .exhaustive();
  }

  if (upsertTenantBatch.length > 0) {
    await tenantService.upsertBatchTenantItems(upsertTenantBatch, dbContext);
  }

  if (upsertTenantSelfcareIdBatch.length > 0) {
    await tenantService.upsertBatchTenantSelfCareIdItems(
      upsertTenantSelfcareIdBatch,
      dbContext
    );
  }

  if (deleteTenantBatch.length > 0) {
    await tenantService.deleteBatchTenants(deleteTenantBatch, dbContext);
  }

  if (deleteTenantMailBatch.length > 0) {
    await tenantService.deleteBatchTenantMailsByTenantId(
      deleteTenantMailBatch,
      dbContext
    );
  }
}
