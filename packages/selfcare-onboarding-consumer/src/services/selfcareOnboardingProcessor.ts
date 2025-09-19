import {
  getInteropHeaders,
  logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { EachMessagePayload } from "kafkajs";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  generateId,
  CorrelationId,
  genericInternalError,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { TenantProcessClient } from "../clients/tenantProcessClient.js";
import { InstitutionEventPayload } from "../model/institutionEvent.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function selfcareOnboardingProcessorBuilder(
  refreshableToken: RefreshableInteropToken,
  tenantProcessClient: TenantProcessClient,
  productName: string,
  allowedOrigins: string[]
) {
  return {
    async processMessage({
      message,
      partition,
    }: EachMessagePayload): Promise<void> {
      const correlationId: CorrelationId = generateId();

      const loggerInstance = logger({
        serviceName: "selfcare-onboarding-consumer",
        correlationId,
      });

      try {
        loggerInstance.info(
          `Consuming message for partition ${partition} with offset ${message.offset}`
        );

        if (!message.value) {
          loggerInstance.warn(
            `Empty message for partition ${partition} with offset ${message.offset}`
          );
          return;
        }

        const stringPayload = message.value.toString();
        const jsonPayload = JSON.parse(stringPayload);

        // Process only messages of our product
        // Note: doing this before parsing to avoid errors on messages of other products
        if (jsonPayload.product !== productName) {
          loggerInstance.info(
            `Skipping message for partition ${partition} with offset ${message.offset} - Not required product: ${jsonPayload.product}`
          );
          return;
        }

        const eventPayload = InstitutionEventPayload.parse(jsonPayload);

        const institution = eventPayload.institution;
        const origin = match(institution.institutionType)
          .with("SCP", () => `${institution.origin}-SCP`)
          .with("PRV", () => `${institution.origin}-PRV`)
          .with("PT", () => `${institution.origin}-PT`)
          .otherwise(() => institution.origin);

        if (!allowedOrigins.includes(origin)) {
          loggerInstance.warn(
            `Skipping message for partition ${partition} with offset ${message.offset} - Not allowed origin. SelfcareId: ${eventPayload.institutionId} Origin: ${institution.origin} OriginId: ${institution.originId} InstitutionType: ${institution.institutionType}`
          );
          return;
        }

        const externalIdValue =
          institution.origin === PUBLIC_ADMINISTRATIONS_IDENTIFIER
            ? institution.subUnitCode || institution.originId
            : institution.taxCode || institution.originId;

        const seed: tenantApi.SelfcareTenantSeed = {
          externalId: {
            origin,
            value: externalIdValue,
          },
          selfcareId: eventPayload.institutionId,
          name: institution.description,
          onboardedAt: eventPayload.createdAt,
          digitalAddress: {
            kind: tenantApi.MailKind.Values.DIGITAL_ADDRESS,
            description: "Domicilio digitale",
            address: institution.digitalAddress,
          },
          subUnitType: institution.subUnitType || undefined,
        };

        const token = (await refreshableToken.get()).serialized;

        const headers = getInteropHeaders({ token, correlationId });

        await tenantProcessClient.selfcare.selfcareUpsertTenant(seed, {
          headers,
        });

        loggerInstance.info(
          `Message in partition ${partition} with offset ${message.offset} correctly consumed. SelfcareId: ${eventPayload.institutionId} Origin: ${institution.origin} OriginId: ${institution.originId}`
        );
      } catch (err) {
        throw genericInternalError(
          `Error consuming message in partition ${partition} with offset ${message.offset}. Reason: ${err}`
        );
      }
    },
  };
}
