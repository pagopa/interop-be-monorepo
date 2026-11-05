import { ContactDB } from "pagopa-interop-contact-data-db-models";

export interface ContactReferenceChecker {
  /**
   * Returns the subset of the given contact IDs that are still referenced by a
   * tenant, with a single lookup for the whole page.
   */
  findReferencedContactIds: (
    ids: Array<ContactDB["id"]>
  ) => Promise<ReadonlySet<ContactDB["id"]>>;
}

/**
 * Placeholder until the tenant readmodel references contacts (WI2): no
 * reference can be verified, so every contact is preserved.
 */
export const unavailableContactReferenceChecker: ContactReferenceChecker = {
  findReferencedContactIds: () =>
    Promise.reject(
      new Error(
        "Contact references cannot be verified: the tenant readmodel does not reference contacts yet"
      )
    ),
};
