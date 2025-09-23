import { TenantEventEnvelopeV2 } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";

export async function handleTenantEvent(
  decodedMessage: TenantEventEnvelopeV2,
  _eventTimestamp: Date,
  _logger: Logger,
  _m2mEventWriterService: M2MEventWriterServiceSQL,
  _readModelService: ReadModelServiceSQL
): Promise<void> {
  return match(decodedMessage)
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
          "MaintenanceTenantDeleted",
          "TenantMailAdded",
          "TenantVerifiedAttributeExtensionUpdated",
          "MaintenanceTenantPromotedToCertifier",
          "TenantMailDeleted",
          "TenantKindUpdated",
          "TenantDelegatedProducerFeatureAdded",
          "TenantDelegatedProducerFeatureRemoved",
          "MaintenanceTenantUpdated",
          "TenantDelegatedConsumerFeatureAdded",
          "TenantDelegatedConsumerFeatureRemoved"
        ),
      },
      () => Promise.resolve(void 0)
    )
    .exhaustive();
}
