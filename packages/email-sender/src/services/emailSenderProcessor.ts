/* eslint-disable functional/no-let */
import {
  genericInternalError,
  EmailNotificationMessagePayload,
  UserId,
  TenantId,
} from "pagopa-interop-models";
import { EachMessagePayload } from "kafkajs";
import { delay, EmailManagerSES, logger, Logger } from "pagopa-interop-commons";
import { TooManyRequestsException } from "@aws-sdk/client-sesv2";
import { match } from "ts-pattern";
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import { TenantReadModelService } from "pagopa-interop-readmodel";
import { HtmlTemplateService } from "pagopa-interop-commons";
import { config } from "../config/config.js";

export async function getUserFromSelfcare(
  userId: UserId,
  tenantId: TenantId,
  loggerInstance: Logger,
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient,
  tenantReadModelService: TenantReadModelService
): Promise<{ email: string; name: string } | undefined> {
  const tenant = await tenantReadModelService.getTenantById(tenantId);
  if (!tenant) {
    throw genericInternalError(
      `Tenant ${tenantId} not found in readmodel for user ${userId}`
    );
  }
  if (!tenant.data.selfcareId) {
    throw genericInternalError(
      `Tenant ${tenantId} has no selfcareId in readmodel for user ${userId}`
    );
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < config.selfcareApiMaxRetries; attempt++) {
    try {
      const resp =
        await selfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET({
          params: {
            institutionId: tenant.data.selfcareId,
          },
          queries: {
            userId,
          },
        });
      if (resp.length === 0) {
        loggerInstance.info(
          `No users found in Selfcare for userId ${userId} and tenant ${tenantId}`
        );
        return undefined;
      }

      if (resp.length > 1) {
        loggerInstance.error(
          `Multiple users (${resp.length}) found in Selfcare for userId ${userId} and tenant ${tenantId}`
        );
        return undefined;
      }

      const { email, name, surname } = resp[0];
      if (!email) {
        loggerInstance.error(
          `User ${userId} in tenant ${tenantId} has no email in Selfcare`
        );
        return undefined;
      }

      return { email, name: `${name} ${surname}` };
    } catch (error) {
      lastError = error;
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 404
      ) {
        loggerInstance.info(
          `User ${userId} not found in Selfcare for tenant ${tenantId} (404)`
        );
        return undefined;
      }

      if (attempt < config.selfcareApiMaxRetries - 1) {
        loggerInstance.info(
          `Selfcare API call failed (attempt ${attempt + 1}/${
            config.selfcareApiMaxRetries
          }). Retrying in ${
            config.selfcareApiRetryDelayInMillis
          }ms. Error: ${error}`
        );
        await delay(config.selfcareApiRetryDelayInMillis);
      }
    }
  }

  // If we reach here, all retries failed
  throw genericInternalError(
    `Failed to fetch user ${userId} of tenant ${tenantId} from Selfcare after ${config.selfcareApiMaxRetries} attempts. Last error: ${lastError}`
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function emailSenderProcessorBuilder(
  sesSenderData: {
    label: string;
    mail: string;
  },
  sesEmailManager: EmailManagerSES,
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient,
  tenantReadModelService: TenantReadModelService,
  templateService: HtmlTemplateService
) {
  return {
    async processMessage({
      message,
      partition,
    }: EachMessagePayload): Promise<void> {
      let loggerInstance = logger({ serviceName: "email-sender" });

      if (!message.value) {
        // Log and skip message
        loggerInstance.info(
          `Empty message for partition ${partition} with offset ${message.offset}`
        );
        return;
      }

      const {
        success,
        error,
        data: jsonPayload,
      } = EmailNotificationMessagePayload.safeParse(
        JSON.parse(message.value.toString())
      );

      if (!success) {
        // Log and skip message
        loggerInstance.warn(
          `Error consuming message in partition ${partition} with offset ${message.offset}. Reason: ${error}`
        );
        return;
      }

      loggerInstance = logger({
        serviceName: "email-sender",
        correlationId: jsonPayload.correlationId,
      });
      loggerInstance.info(
        `Consuming message for partition ${partition} with offset ${message.offset}`
      );

      const emailMessage = await match(jsonPayload)
        .with({ type: "User" }, async ({ userId, tenantId }) => {
          const user = await getUserFromSelfcare(
            userId,
            tenantId,
            loggerInstance,
            selfcareV2InstitutionClient,
            tenantReadModelService
          );
          return user
            ? {
                to: user.email,
                html: templateService.compileHtml(jsonPayload.email.body, {
                  recipientName: `${user.name}`,
                }),
              }
            : undefined;
        })
        .with({ type: "Tenant" }, ({ address }) => ({
          to: address,
          html: jsonPayload.email.body,
        }))
        .exhaustive();

      if (emailMessage === undefined) {
        loggerInstance.info(
          `Skipping message, it is not possible to retrieve the email for user ${
            jsonPayload.type === "User" ? jsonPayload.userId : ""
          } of the tenant ${jsonPayload.tenantId} `
        );

        return;
      }

      const mailOptions = {
        from: { name: sesSenderData.label, address: sesSenderData.mail },
        subject: jsonPayload.email.subject,
        to: [emailMessage.to],
        html: emailMessage.html,
      };

      let sent = false;
      while (!sent) {
        try {
          await sesEmailManager.send(mailOptions, loggerInstance);
          sent = true;
          loggerInstance.info(
            `Email sent for message in partition ${partition} with offset ${message.offset}.`
          );
          await delay(config.successDelayInMillis);
        } catch (err) {
          if (err instanceof TooManyRequestsException) {
            loggerInstance.error(
              `Email sending attempt failed for message in partition ${partition} with offset ${message.offset}. Reason: ${err}. Attempting retry in ${config.retryDelayInMillis}ms`
            );
            await delay(config.retryDelayInMillis);
          } else {
            throw genericInternalError(
              `Email sending attempt failed for message in partition ${partition} with offset ${message.offset}. Reason: ${err} `
            );
          }
        }
      }
    },
  };
}
