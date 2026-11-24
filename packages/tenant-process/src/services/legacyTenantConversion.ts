import {
  CreateEvent,
  getLatestTenantMailOfKind,
  Logger,
} from "pagopa-interop-commons";
import {
  ContactId,
  CorrelationId,
  Tenant,
  TenantEvent,
  tenantMailKind,
  WithMetadata,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

import { toCreateEventTenantContactAdded } from "../model/domain/toEvent.js";
import { ContactDataManagerService } from "./contactDataManagerService.js";

/**
 * A legacy tenant still holds the mails decoded from its V1/V2 events. V3
 * events carry no mails, so the tenant is converted before being written: its
 * most recent contact email becomes a contact in the Contact Data Manager,
 * referenced by contactId, and the mails are removed. The digital address and
 * the mail descriptions are discarded.
 *
 * The conversion runs once the operation is going to write, after its
 * validations: a request that fails creates no contact.
 */
export type LegacyTenantConversion = {
  /**
   * The tenant after the conversion. When a contact has been created its
   * version is already one more than the current one, so the operation events
   * keep building their versions from tenant.metadata.version.
   */
  tenant: WithMetadata<Tenant>;
  /**
   * TenantContactAdded, when a contact has been created: it must be written
   * before the operation events, in the same transaction.
   */
  events: Array<CreateEvent<TenantEvent>>;
  /**
   * Applies the conversion to a tenant built from the original one.
   */
  convert: (tenant: Tenant) => Tenant;
};

/**
 * The tenant is written as it is: it holds no legacy mails, or the operation
 * replaces them itself.
 */
export const noLegacyTenantConversion = (
  tenant: WithMetadata<Tenant>
): LegacyTenantConversion => ({
  tenant,
  events: [],
  convert: (t) => t,
});

async function createContactFromLegacyMails(
  tenant: Tenant,
  contactDataManagerService: ContactDataManagerService,
  ctx: { correlationId: CorrelationId; logger: Logger }
): Promise<ContactId | undefined> {
  if (tenant.contactId !== undefined) {
    // Not expected: a tenant with a contact is written only as V3, which
    // carries no mails. The contact is kept and only the mails are removed.
    ctx.logger.warn(
      `Tenant ${tenant.id} has both legacy mails and contact ${tenant.contactId}: the mails are removed`
    );
    return undefined;
  }

  const contactEmail = getLatestTenantMailOfKind(
    tenant.mails,
    tenantMailKind.ContactEmail
  );
  if (!contactEmail) {
    ctx.logger.info(
      `Legacy tenant ${tenant.id} has no contact email: it is converted without a contact`
    );
    return undefined;
  }

  const result = await contactDataManagerService.createContact(
    contactEmail.address,
    ctx
  );

  return match(result)
    .with({ type: "created" }, ({ contactId }) => {
      ctx.logger.info(
        `Contact ${contactId} created from the contact email of legacy tenant ${tenant.id}`
      );
      return contactId;
    })
    .with({ type: "invalidEmail" }, () => {
      ctx.logger.warn(
        `The contact email of legacy tenant ${tenant.id} was rejected by the Contact Data Manager: the tenant is converted without a contact`
      );
      return undefined;
    })
    .exhaustive();
}

export async function convertLegacyTenant(
  tenant: WithMetadata<Tenant>,
  contactDataManagerService: ContactDataManagerService,
  ctx: { correlationId: CorrelationId; logger: Logger }
): Promise<LegacyTenantConversion> {
  if (tenant.data.mails.length === 0) {
    return noLegacyTenantConversion(tenant);
  }

  const newContactId = await createContactFromLegacyMails(
    tenant.data,
    contactDataManagerService,
    ctx
  );

  const convert = (t: Tenant): Tenant => ({
    ...t,
    mails: [],
    contactId: newContactId ?? t.contactId,
  });

  if (newContactId === undefined) {
    // The mails go away with the operation event, with no conversion event
    return {
      tenant: { data: convert(tenant.data), metadata: tenant.metadata },
      events: [],
      convert,
    };
  }

  const tenantWithContact: Tenant = {
    ...convert(tenant.data),
    updatedAt: new Date(),
  };

  return {
    tenant: {
      data: tenantWithContact,
      metadata: { version: tenant.metadata.version + 1 },
    },
    events: [
      toCreateEventTenantContactAdded(
        tenant.metadata.version,
        tenantWithContact,
        newContactId,
        ctx.correlationId
      ),
    ],
    convert,
  };
}
