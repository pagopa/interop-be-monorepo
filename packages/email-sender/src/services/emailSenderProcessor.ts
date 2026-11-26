/* eslint-disable functional/no-let */
import { TooManyRequestsException } from "@aws-sdk/client-sesv2";
import { EachMessagePayload } from "kafkajs";
import {
  contactDataApi,
  SelfcareV2InstitutionClient,
} from "pagopa-interop-api-clients";
import {
  delay,
  EmailManagerSES,
  logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { HtmlTemplateService } from "pagopa-interop-commons";
import {
  genericInternalError,
  EmailNotificationMessagePayload,
} from "pagopa-interop-models";
import { TenantReadModelService } from "pagopa-interop-readmodel";
import { match } from "ts-pattern";

import { config } from "../config/config.js";
import {
  getTenantContactEmail,
  getUserFromSelfcare,
} from "./recipientLookup.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function emailSenderProcessorBuilder(
  sesSenderData: {
    label: string;
    mail: string;
  },
  sesEmailManager: EmailManagerSES,
  selfcareV2InstitutionClient: SelfcareV2InstitutionClient,
  tenantReadModelService: TenantReadModelService,
  templateService: HtmlTemplateService,
  contactClient: Pick<contactDataApi.ContactDataManagerClient, "getContact">,
  token: Pick<RefreshableInteropToken, "get">
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

      const { success, data: jsonPayload } =
        EmailNotificationMessagePayload.safeParse(
          JSON.parse(message.value.toString())
        );

      if (!success) {
        // Log and skip message
        loggerInstance.warn(
          `Error consuming message in partition ${partition} with offset ${message.offset}: invalid email notification payload`
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
        .with({ type: "Tenant" }, async (recipient) => {
          const address =
            recipient.contactId !== undefined
              ? await getTenantContactEmail(
                  recipient.contactId,
                  recipient.correlationId,
                  contactClient,
                  token,
                  loggerInstance
                )
              : recipient.address;
          return address
            ? { to: address, html: recipient.email.body }
            : undefined;
        })
        .exhaustive();

      if (emailMessage === undefined) {
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
              `Email sending attempt failed for message in partition ${partition} with offset ${message.offset}. SES throttled the request. Attempting retry in ${config.retryDelayInMillis}ms`
            );
            await delay(config.retryDelayInMillis);
          } else {
            throw genericInternalError(
              `Email sending attempt failed for message in partition ${partition} with offset ${message.offset}.`
            );
          }
        }
      }
    },
  };
}
