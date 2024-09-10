import { logger, RefreshableInteropToken } from "pagopa-interop-commons";
import { EachMessagePayload } from "kafkajs";
import { v4 as uuidv4 } from "uuid";
import { tenantApi } from "pagopa-interop-api-clients";
import { TenantProcessClient } from "../clients/tenantProcessClient.js";
import { InstitutionEventPayload } from "../model/institutionEvent.js";
import { ORIGIN_IPA } from "../model/constants.js";

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
      const correlationId = uuidv4();

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
        }

        const eventPayload = InstitutionEventPayload.parse(jsonPayload);

        const institution = eventPayload.institution;
        if (allowedOrigins.indexOf(institution.origin) < 0) {
          loggerInstance.warn(
            `Skipping message for partition ${partition} with offset ${message.offset} - Not allowed origin. SelfcareId: ${eventPayload.internalIstitutionID} Origin: ${institution.origin} OriginId: ${institution.originId}`
          );
          return;
        }

        const externalIdValue =
          institution.origin === ORIGIN_IPA
            ? institution.subUnitCode || institution.originId
            : institution.taxCode || institution.originId;

        const seed: tenantApi.SelfcareTenantSeed = {
          externalId: {
            origin: institution.origin,
            value: externalIdValue,
          },
          selfcareId: eventPayload.internalIstitutionID,
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

        const headers = {
          "X-Correlation-Id": correlationId,
          Authorization: `Bearer ${token}`,
        };

        await tenantProcessClient.selfcare.selfcareUpsertTenant(seed, {
          headers,
        });

        loggerInstance.info(
          `Message in partition ${partition} with offset ${message.offset} correctly consumed. SelfcareId: ${eventPayload.internalIstitutionID} Origin: ${institution.origin} OriginId: ${institution.originId}`
        );
      } catch (err) {
        const errorMessage = `Error consuming message in partition ${partition} with offset ${message.offset}. Reason: ${err}`;
        loggerInstance.error(errorMessage);
        throw new Error(errorMessage, { cause: err });
      }
    },
  };
}
