import { isAxiosError } from "axios";
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import { delay, Logger } from "pagopa-interop-commons";
import {
  ContactId,
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
): Promise<T> {
  const { recipientLookupMaxAttempts, recipientLookupRetryDelayInMillis } =
    config;
  // eslint-disable-next-line functional/no-let
  for (let attempt = 1; attempt <= recipientLookupMaxAttempts; attempt++) {
    try {
      return await fetchRecipient();
    } catch {
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
      selfcareV2InstitutionClient
        .getInstitutionUsersByProductUsingGET({
          params: { institutionId },
          queries: { userId },
        })
        .catch((error: unknown) => {
          const status = isAxiosError(error)
            ? (error.response?.status ?? error.status)
            : error && typeof error === "object" && "status" in error
              ? error.status
              : undefined;
          if (status === 404) {
            loggerInstance.info(
              `User ${userId} of tenant ${tenantId} not found in Selfcare (404), skipping recipient`
            );
            return undefined;
          }
          throw error;
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

export type ContactEmailReader = (id: ContactId) => Promise<string | undefined>;

export async function getTenantContactEmail(
  contactId: ContactId,
  readEmail: ContactEmailReader,
  logger: Logger
): Promise<string | undefined> {
  const address = await lookupRecipient(
    () => readEmail(contactId),
    `contact ${contactId}`,
    logger
  );
  if (address === undefined) {
    logger.info(`Contact ${contactId} not found, skipping recipient`);
  }
  return address;
}
