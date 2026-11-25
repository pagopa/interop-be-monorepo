import { ContactId } from "../brandedIds.js";
import { genericError } from "../errors.js";

/**
 * V3 tenant payloads reference the tenant contact only through an opaque CDM
 * identifier: any other value (e.g. a plain-text email address) is rejected,
 * both when building and when reading a V3 payload. The rejected value is
 * deliberately left out of the error, so that it cannot leak into the logs.
 */
export function assertOpaqueContactId(
  contactId: string | undefined
): asserts contactId is ContactId | undefined {
  if (contactId !== undefined && !ContactId.safeParse(contactId).success) {
    throw genericError(
      "Tenant V3 event rejected: contactId is not an opaque contact identifier"
    );
  }
}
