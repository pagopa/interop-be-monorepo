import {
  fromTenantV2,
  missingKafkaMessageDataError,
  TenantEventEnvelopeV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import { toTenantM2MEventSQL } from "../models/tenantM2MEventAdapterSQL.js";
import { createTenantM2MEvent } from "../services/event-builders/tenantM2MEventBuilder.js";

export async function handleTenantEvent(
  decodedMessage: TenantEventEnvelopeV2,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL
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
      async (event) => {
        if (!event.data.tenant) {
          throw missingKafkaMessageDataError("tenant", event.type);
        }
        const tenant = fromTenantV2(event.data.tenant);

        logger.info(
          `Creating Tenant M2M Event - type ${event.type}, tenantId ${tenant.id}`
        );

        const m2mEvent = createTenantM2MEvent(
          tenant,
          event.version,
          event.type,
          eventTimestamp
        );

        await m2mEventWriterService.insertTenantM2MEvent(
          toTenantM2MEventSQL(m2mEvent)
        );
      }
    )
    .exhaustive();
}
