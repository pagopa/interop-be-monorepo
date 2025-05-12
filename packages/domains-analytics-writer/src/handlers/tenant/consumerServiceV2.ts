/* eslint-disable functional/immutable-data */
import {
  fromTenantV2,
  genericInternalError,
  TenantEventEnvelopeV2,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { splitTenantIntoObjectsSQL } from "pagopa-interop-readmodel";
import {
  TenantFeatureSQL,
  TenantItemsSQL,
  TenantMailSQL,
  TenantSQL,
} from "pagopa-interop-readmodel-models";
import { DBContext } from "../../db/db.js";
import { tenantServiceBuilder } from "../../service/tenantService.js";

export async function handleTenantMessageV2(
  messages: TenantEventEnvelopeV2[],
  dbContext: DBContext
): Promise<void> {
  const tenantService = tenantServiceBuilder(dbContext);

  const upsertBatch: TenantItemsSQL[] = [];
  const deleteTenantBatch: Array<TenantSQL["id"]> = [];
  const deleteTenantMailBatch: Array<TenantMailSQL["id"]> = [];
  const deleteTenantFeatureBatch: TenantFeatureSQL[] = [];

  for (const message of messages) {
    match(message)
      .with({ type: "MaintenanceTenantDeleted" }, (msg) => {
        deleteTenantBatch.push(msg.data.tenantId);
      })
      .with({ type: "TenantMailDeleted" }, (msg) => {
        deleteTenantMailBatch.push(msg.data.mailId);
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
            throw genericInternalError("Tenant not found in message");
          }

          const splitResult: TenantItemsSQL = splitTenantIntoObjectsSQL(
            fromTenantV2(msg.data.tenant),
            message.version
          );

          deleteTenantFeatureBatch.push(...splitResult.featuresSQL);
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
            throw genericInternalError("Tenant not found in message");
          }

          const splitResult: TenantItemsSQL = splitTenantIntoObjectsSQL(
            fromTenantV2(msg.data.tenant),
            message.version
          );

          upsertBatch.push(splitResult);
        }
      )
      .exhaustive();
  }

  if (upsertBatch.length > 0) {
    await tenantService.upsertBatchTenantItems(upsertBatch, dbContext);
  }

  if (deleteTenantBatch.length > 0) {
    await tenantService.deleteBatchTenants(deleteTenantBatch, dbContext);
  }

  if (deleteTenantMailBatch.length > 0) {
    await tenantService.deleteBatchTenantMails(
      deleteTenantMailBatch,
      dbContext
    );
  }

  if (deleteTenantFeatureBatch.length > 0) {
    await tenantService.deleteBatchTenantFeatures(
      deleteTenantFeatureBatch,
      dbContext
    );
  }
}
