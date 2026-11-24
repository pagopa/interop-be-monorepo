/* eslint-disable @typescript-eslint/no-floating-promises */
import { tenantApi } from "pagopa-interop-api-clients";
import {
  getMockAuthData,
  getMockContext,
  getMockTenant,
  getMockTenantMail,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { Tenant } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { tenantMailsNotAllowed } from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  contactDataManagerService,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

describe("addTenantMail", async () => {
  const mailSeed: tenantApi.MailSeed = {
    kind: "CONTACT_EMAIL",
    address: "testMail@test.it",
    description: "mail description",
  };

  it.each([
    { description: "without mails", mails: [] },
    { description: "with legacy mails", mails: [getMockTenantMail()] },
  ])(
    "Should throw tenantMailsNotAllowed for a tenant $description, without writing events",
    async ({ mails }) => {
      const tenant: Tenant = { ...getMockTenant(), mails };
      await addOneTenant(tenant);

      await expect(
        tenantService.addTenantMail(
          { tenantId: tenant.id, mailSeed },
          getMockContext({ authData: getMockAuthData(tenant.id) })
        )
      ).rejects.toThrowError(tenantMailsNotAllowed(tenant.id));

      const lastEvent = await readLastEventByStreamId(
        tenant.id,
        "tenant",
        postgresDB
      );
      expect(lastEvent).toMatchObject({
        version: "0",
        type: "TenantOnboarded",
      });
      expect(contactDataManagerService.createContact).not.toHaveBeenCalled();
    }
  );
});
