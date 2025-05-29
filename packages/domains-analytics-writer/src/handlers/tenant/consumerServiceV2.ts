/* eslint-disable functional/immutable-data */
import {
  fromTenantV2,
  genericInternalError,
  TenantEventEnvelopeV2,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { splitTenantIntoObjectsSQL } from "pagopa-interop-readmodel";
import { z } from "zod";
import { DBContext } from "../../db/db.js";
import { tenantServiceBuilder } from "../../service/tenantService.js";
import {
  TenantItemsSchema,
  TenantDeletingSchema,
} from "../../model/tenant/tenant.js";
import { TenantDbTable } from "../../model/db/tenant.js";

export async function handleTenantMessageV2(
  messages: TenantEventEnvelopeV2[],
  dbContext: DBContext
): Promise<void> {
  const tenantService = tenantServiceBuilder(dbContext);

  const upsertTenantBatch: TenantItemsSchema[] = [];
  const deleteTenantBatch: TenantDeletingSchema[] = [];

  for (const message of messages) {
    match(message)
      .with({ type: "MaintenanceTenantDeleted" }, (msg) => {
        deleteTenantBatch.push(
          TenantDeletingSchema.parse({
            id: msg.data.tenantId,
            deleted: true,
          } satisfies z.input<typeof TenantDeletingSchema>)
        );
      })
      .with(
        {
          type: P.union(
            "TenantOnboarded",
            "TenantOnboardDetailsUpdated",
            "TenantCertifiedAttributeAssigned",
            "TenantCertifiedAttributeRevoked",
            "TenantDeclaredAttributeAssigned",
            "TenantDeclaredAttributeRevoked",
            "TenantVerifiedAttributeAssigned",
            "TenantVerifiedAttributeRevoked",
            "TenantVerifiedAttributeExpirationUpdated",
            "TenantVerifiedAttributeExtensionUpdated",
            "TenantMailAdded",
            "MaintenanceTenantPromotedToCertifier",
            "MaintenanceTenantUpdated",
            "TenantMailDeleted",
            "TenantKindUpdated",
            "TenantDelegatedProducerFeatureAdded",
            "TenantDelegatedProducerFeatureRemoved",
            "TenantDelegatedConsumerFeatureAdded",
            "TenantDelegatedConsumerFeatureRemoved"
          ),
        },
        (msg) => {
          if (!msg.data.tenant) {
            throw genericInternalError(
              "Tenant can't be missing in the event message"
            );
          }

          const splitResult = splitTenantIntoObjectsSQL(
            fromTenantV2(msg.data.tenant),
            message.version
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
      .exhaustive();
  }

  if (upsertTenantBatch.length > 0) {
    console.log(
      "TARGET POST PRE DELETING?  ---------->",
      await dbContext.conn.query(
        `SELECT * FROM domains.${TenantDbTable.tenant_mail};`
      )
    );

    await tenantService.upsertBatchTenantItems(upsertTenantBatch, dbContext);

    const clenatDeletingTenantBatch: TenantDeletingSchema[] =
      upsertTenantBatch.map((batch) => ({
        id: batch.tenantSQL.id,
        deleted: true,
      }));

    console.log("preUpsertDeleteTenantBatch", preUpsertDeleteTenantBatch);
    await tenantService.deleteBatchTenants(
      preUpsertDeleteTenantBatch,
      dbContext
    );
  }

  if (deleteTenantBatch.length > 0) {
    await tenantService.deleteBatchTenants(deleteTenantBatch, dbContext);
  }
}
