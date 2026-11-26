import { isAxiosError } from "axios";
import {
  SelfcareV2InstitutionClient,
  contactDataApi,
} from "pagopa-interop-api-clients";
import { delay, Logger, RefreshableInteropToken } from "pagopa-interop-commons";
import {
  ContactId,
  CorrelationId,
  genericInternalError,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { TenantReadModelService } from "pagopa-interop-readmodel";

import { config } from "../config/config.js";

async function lookupRecipient<T>(
  fetchRecipient: () => Promise<T>,
  description: string,
  logger: Logger
): Promise<T | undefined> {
  const { recipientLookupMaxAttempts, recipientLookupRetryDelayInMillis } =
    config;
  // eslint-disable-next-line functional/no-let
  for (let attempt = 1; attempt <= recipientLookupMaxAttempts; attempt++) {
    try {
      return await fetchRecipient();
    } catch (error) {
      const status = isAxiosError(error)
        ? (error.response?.status ?? error.status)
        : error && typeof error === "object" && "status" in error
          ? error.status
          : undefined;
      if (status === 404) {
        logger.info(`${description} not found (404), skipping recipient`);
        return undefined;
      }
      if (attempt < recipientLookupMaxAttempts) {
        logger.warn(
          `Failed to fetch ${description} (attempt ${attempt}/${recipientLookupMaxAttempts}). Retrying in ${recipientLookupRetryDelayInMillis}ms`
        );
        await delay(recipientLookupRetryDelayInMillis);
      }
    }
  }
  throw genericInternalError(
    `Failed to fetch ${description} after ${recipientLookupMaxAttempts} attempts`
  );
}

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

  const institutionId = tenant.data.selfcareId;
  const users = await lookupRecipient(
    () =>
      selfcareV2InstitutionClient.getInstitutionUsersByProductUsingGET({
        params: { institutionId },
        queries: { userId },
      }),
    `user ${userId} of tenant ${tenantId} from Selfcare`,
    loggerInstance
  );
  if (!users) {
    return undefined;
  }
  if (users.length === 0) {
    loggerInstance.info(
      `No users found in Selfcare for userId ${userId} and tenant ${tenantId}`
    );
    return undefined;
  }

  if (users.length > 1) {
    loggerInstance.error(
      `Multiple users (${users.length}) found in Selfcare for userId ${userId} and tenant ${tenantId}`
    );
    return undefined;
  }

  const { email, name, surname } = users[0];
  if (!email) {
    loggerInstance.error(
      `User ${userId} in tenant ${tenantId} has no email in Selfcare`
    );
    return undefined;
  }

  return { email, name: `${name} ${surname}` };
}

export function getTenantContactEmail(
  contactId: ContactId,
  correlationId: CorrelationId,
  client: Pick<contactDataApi.ContactDataManagerClient, "getContact">,
  token: Pick<RefreshableInteropToken, "get">,
  logger: Logger
): Promise<string | undefined> {
  return lookupRecipient(
    async () => {
      // A token generation failure must remain retryable, including a KMS 404.
      const { serialized } = await token.get().catch(() => {
        throw genericInternalError("Unable to obtain internal token for CDM");
      });
      const { email } = await client.getContact({
        params: { contactId },
        headers: {
          Authorization: `Bearer ${serialized}`,
          "X-Correlation-Id": correlationId,
        },
      });
      return email;
    },
    `contact ${contactId} from CDM`,
    logger
  );
}
