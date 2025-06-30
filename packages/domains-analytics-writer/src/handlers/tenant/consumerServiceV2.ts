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
import { TenantMailDeletingSchema } from "../../model/tenant/tenantMail.js";
import { TenantFeatureDeletingSchema } from "../../model/tenant/tenantFeature.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handleTenantMessageV2(
  messages: TenantEventEnvelopeV2[],
  dbContext: DBContext
): Promise<void> {
  const tenantService = tenantServiceBuilder(dbContext);

  const upsertTenantBatch: TenantItemsSchema[] = [];
  const deleteTenantBatch: TenantDeletingSchema[] = [];
  const deleteTenantMailBatch: TenantMailDeletingSchema[] = [];
  const deleteTenantFeatureBatch: TenantFeatureDeletingSchema[] = [];

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
      .with({ type: "TenantMailDeleted" }, (msg) => {
        if (!msg.data.tenant) {
          throw genericInternalError(
            "Tenant can't be missing in the event message"
          );
        }

        deleteTenantMailBatch.push(
          TenantMailDeletingSchema.parse({
            id: msg.data.mailId,
            tenantId: msg.data.tenant.id,
            deleted: true,
          } satisfies z.input<typeof TenantMailDeletingSchema>)
        );
      })
      .with(
        {
          type: P.union(
            "TenantDelegatedConsumerFeatureRemoved",
            "TenantDelegatedProducerFeatureRemoved"
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

          const features = splitResult.featuresSQL.map((r) =>
            TenantFeatureDeletingSchema.parse({
              tenantId: r.tenantId,
              kind: r.kind,
              deleted: true,
            } satisfies z.input<typeof TenantFeatureDeletingSchema>)
          );

          deleteTenantFeatureBatch.push(...features);
        }
      )
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
            "MaintenanceTenantPromotedToCertifier",
            "MaintenanceTenantUpdated",
            "TenantMailAdded",
            "TenantKindUpdated",
            "TenantDelegatedProducerFeatureAdded",
            "TenantDelegatedConsumerFeatureAdded"
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
    await tenantService.upsertBatchTenantItems(upsertTenantBatch, dbContext);
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

  if (deleteTenantFeatureBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteTenantFeatureBatch,
      TenantFeatureDeletingSchema,
      ["tenantId", "kind"]
    );
    await tenantService.deleteBatchTenantFeatures(distinctBatch, dbContext);
  }
}
