import { isAxiosError } from "axios";
import { contactDataApi } from "pagopa-interop-api-clients";
import {
  getInteropHeaders,
  Logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { ContactId, CorrelationId, unsafeBrandId } from "pagopa-interop-models";

import { contactCreationFailed } from "../model/domain/errors.js";

export type ContactCreationResult =
  | { type: "created"; contactId: ContactId }
  // The Contact Data Manager rejected the email address (400)
  | { type: "invalidEmail" };

export type ContactDataManagerService = {
  createContact: (
    email: string,
    ctx: { correlationId: CorrelationId; logger: Logger }
  ) => Promise<ContactCreationResult>;
};

/**
 * Thin wrapper around the Contact Data Manager client. The email address is
 * personal data: it is never logged, and the client errors, whose request
 * config contains it, are never propagated.
 */
export function contactDataManagerServiceBuilder(
  contactDataManagerClient: contactDataApi.ContactDataManagerClient,
  refreshableToken: RefreshableInteropToken
): ContactDataManagerService {
  return {
    async createContact(email, { correlationId, logger }) {
      const token = (await refreshableToken.get()).serialized;

      try {
        const contact = await contactDataManagerClient.createContact(
          { email },
          { headers: getInteropHeaders({ token, correlationId }) }
        );
        return {
          type: "created",
          contactId: unsafeBrandId<ContactId>(contact.id),
        };
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 400) {
          return { type: "invalidEmail" };
        }

        const reason = isAxiosError(error)
          ? `status ${error.response?.status ?? error.code ?? "unknown"}`
          : "unexpected error";
        logger.error(`Contact Data Manager createContact failed: ${reason}`);
        throw contactCreationFailed(reason);
      }
    },
  };
}
