/* eslint-disable functional/immutable-data */
import {
  fromTenantV1,
  genericInternalError,
  TenantEventEnvelopeV1,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { splitTenantIntoObjectsSQL } from "pagopa-interop-readmodel";
import { z } from "zod";
import { DBContext } from "../../db/db.js";
import { tenantServiceBuilder } from "../../service/tenantService.js";
import {
  TenantItemsSchema,
  TenantDeletingSchema,
  TenantSelfcareIdSchema,
} from "../../model/tenant/tenant.js";
import { TenantMailDeletingSchema } from "../../model/tenant/tenantMail.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handleTenantMessageV1(
  messages: TenantEventEnvelopeV1[],
  dbContext: DBContext
): Promise<void> {
  const tenantService = tenantServiceBuilder(dbContext);

  const upsertTenantBatch: TenantItemsSchema[] = [];
  const deleteTenantBatch: TenantDeletingSchema[] = [];
  const deleteTenantMailBatch: TenantMailDeletingSchema[] = [];
  const upsertTenantSelfcareIdBatch: TenantSelfcareIdSchema[] = [];

  for (const message of messages) {
    await match(message)
      .with(
        {
          type: P.union("TenantCreated", "TenantUpdated", "TenantMailAdded"),
        },
        (msg) => {
          if (!msg.data.tenant) {
            throw genericInternalError(
              "Tenant can't be missing in the event message"
            );
          }

          const splitResult = splitTenantIntoObjectsSQL(
            fromTenantV1(msg.data.tenant),
            msg.version
          );

          upsertTenantBatch.push(
            TenantItemsSchema.parse({
              tenantSQL: splitResult.tenantSQL,
              mailsSQL: splitResult.mailsSQL,
              certifiedAttributesSQL: splitResult.certifiedAttributesSQL,
              declaredAttributesSQL: splitResult.declaredAttributesSQL,
              verifiedAttributesSQL: splitResult.verifiedAttributesSQL,
              verifiedAttributeVerifiersSQL:
                splitResult.verifiedAttributeVerifiersSQL,
              verifiedAttributeRevokersSQL:
                splitResult.verifiedAttributeRevokersSQL,
              featuresSQL: splitResult.featuresSQL,
            } satisfies z.input<typeof TenantItemsSchema>)
          );
        }
      )
      .with({ type: "TenantDeleted" }, (msg) => {
        deleteTenantBatch.push(
          TenantDeletingSchema.parse({
            id: msg.data.tenantId,
            deleted: true,
          } satisfies z.input<typeof TenantDeletingSchema>)
        );
      })
      .with({ type: "TenantMailDeleted" }, (msg) => {
        deleteTenantMailBatch.push(
          TenantMailDeletingSchema.parse({
            id: msg.data.mailId,
            tenantId: msg.data.tenantId,
          } satisfies z.input<typeof TenantMailDeletingSchema>)
        );
      })
      .with({ type: "SelfcareMappingCreated" }, (msg) => {
        upsertTenantSelfcareIdBatch.push(
          TenantSelfcareIdSchema.parse({
            id: msg.data.tenantId,
            selfcareId: msg.data.selfcareId,
            metadataVersion: msg.version,
          } satisfies z.input<typeof TenantSelfcareIdSchema>)
        );
      })
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
    const distinctBatch = distinctByKeys(
      deleteTenantBatch,
      TenantDeletingSchema,
      ["id"]
    );
    await tenantService.deleteBatchTenants(distinctBatch, dbContext);
  }

  if (deleteTenantMailBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteTenantMailBatch,
      TenantMailDeletingSchema,
      ["id", "tenantId"]
    );
    await tenantService.deleteBatchTenantMails(distinctBatch, dbContext);
  }
}
