/* eslint-disable functional/immutable-data */
import { TenantItemsSchema } from "pagopa-interop-kpi-models";
import {
  fromTenantV3,
  genericInternalError,
  TenantEventEnvelopeV3,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { z } from "zod";

import { DBContext } from "../../db/db.js";
import { TenantDeletingSchema } from "../../model/tenant/tenant.js";
import { tenantServiceBuilder } from "../../service/tenantService.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";
import { toTenantItems } from "./tenantItems.js";

export async function handleTenantMessageV3(
  messages: TenantEventEnvelopeV3[],
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
            "MaintenanceTenantPromotedToCertifier",
            "MaintenanceTenantUpdated",
            "TenantCertifiedAttributeAssigned",
            "TenantCertifiedAttributeRevoked",
            "TenantCertifiedDiscreteAttributeAssigned",
            "TenantCertifiedDiscreteAttributeRevoked",
            "TenantCertifiedDiscreteAttributeUpdated",
            "TenantContactAdded",
            "TenantContactDeleted",
            "TenantDeclaredAttributeAssigned",
            "TenantDeclaredAttributeRevoked",
            "TenantDelegatedConsumerFeatureAdded",
            "TenantDelegatedConsumerFeatureRemoved",
            "TenantDelegatedProducerFeatureAdded",
            "TenantDelegatedProducerFeatureRemoved",
            "TenantKindUpdated",
            "TenantOnboardDetailsUpdated",
            "TenantOnboarded",
            "TenantRemoteIdAssigned",
            "MaintenanceTenantRemoteIdDeleted",
            "TenantVerifiedAttributeAssigned",
            "TenantVerifiedAttributeExpirationUpdated",
            "TenantVerifiedAttributeExtensionUpdated",
            "TenantVerifiedAttributeRevoked"
          ),
        },
        (msg) => {
          if (!msg.data.tenant) {
            throw genericInternalError(
              "Tenant can't be missing in the event message"
            );
          }

          upsertTenantBatch.push(
            toTenantItems(fromTenantV3(msg.data.tenant), message.version)
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
}
