import { isAxiosError } from "axios";
import { contactDataApi } from "pagopa-interop-api-clients";
import {
  getInteropHeaders,
  Logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { ContactId, CorrelationId, unsafeBrandId } from "pagopa-interop-models";

import {
  contactCreationFailed,
  ContactCreationFailureReason,
} from "../model/domain/errors.js";

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
      try {
        const token = (await refreshableToken.get()).serialized;
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

        const failure = contactCreationFailed(
          contactCreationFailureReason(error)
        );
        logger.error(failure.detail);
        throw failure;
      }
    },
  };
}

/**
 * Only the status or the axios error code are kept: the error itself, whose
 * request config contains the email address, is discarded.
 */
function contactCreationFailureReason(
  error: unknown
): ContactCreationFailureReason {
  if (!isAxiosError(error)) {
    return { type: "unexpectedError" };
  }
  if (error.response !== undefined) {
    return { type: "errorResponse", status: error.response.status };
  }
  return { type: "noResponse", code: error.code ?? "unknown" };
}
