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
