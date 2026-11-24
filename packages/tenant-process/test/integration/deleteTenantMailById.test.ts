/* eslint-disable @typescript-eslint/no-floating-promises */
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

describe("deleteTenantMailById", async () => {
  it("Should throw tenantMailsNotAllowed even for a mail of the tenant, without writing events", async () => {
    const mail = getMockTenantMail();
    const tenant: Tenant = { ...getMockTenant(), mails: [mail] };
    await addOneTenant(tenant);

    await expect(
      tenantService.deleteTenantMailById(
        { tenantId: tenant.id, mailId: mail.id },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(tenantMailsNotAllowed(tenant.id));

    const lastEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );
    expect(lastEvent).toMatchObject({ version: "0", type: "TenantOnboarded" });
    expect(contactDataManagerService.createContact).not.toHaveBeenCalled();
  });
});
