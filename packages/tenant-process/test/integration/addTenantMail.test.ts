/* eslint-disable @typescript-eslint/no-floating-promises */
import crypto from "crypto";
import {
  Tenant,
  protobufDecoder,
  toTenantV2,
  operationForbidden,
  TenantMailAddedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  getMockAuthData,
  getMockContext,
  getMockTenant,
  getMockTenantMail,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import {
  mailAlreadyExists,
  notValidMailAddress,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

describe("addTenantMail", async () => {
  const mailSeed: tenantApi.MailSeed = {
    kind: "CONTACT_EMAIL",
    address: "testMail@test.it",
    description: "mail description",
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should correctly add the mail if not present", async () => {
    const mockTenant: Tenant = getMockTenant();

    await addOneTenant(mockTenant);
    await tenantService.addTenantMail(
      {
        tenantId: mockTenant.id,
        mailSeed,
      },
      getMockContext({
        authData: getMockAuthData(mockTenant.id),
      })
    );
    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "TenantMailAdded",
      event_version: 2,
    });

    const writtenPayload: TenantMailAddedV2 | undefined = protobufDecoder(
      TenantMailAddedV2
    ).parse(writtenEvent.data);

    const updatedTenant: Tenant = {
      ...mockTenant,
      mails: [
        {
          ...mailSeed,
          id: writtenPayload.mailId,
          createdAt: new Date(),
        },
      ],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should correctly add the mail if address doesn't already exists as the last mail of that kind in the tenant", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      mails: [
        {
          ...mailSeed,
          id: crypto
            .createHash("sha256")
            .update(mailSeed.address)
            .digest("base64"),
          createdAt: new Date(Date.now() - 1000),
        },
        getMockTenantMail(mailSeed.kind),
      ],
    };

    await addOneTenant(mockTenant);
    await tenantService.addTenantMail(
      {
        tenantId: mockTenant.id,
        mailSeed,
      },
      getMockContext({
        authData: getMockAuthData(mockTenant.id),
      })
    );
    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "TenantMailAdded",
      event_version: 2,
    });

    const writtenPayload: TenantMailAddedV2 | undefined = protobufDecoder(
      TenantMailAddedV2
    ).parse(writtenEvent.data);

    const updatedTenant: Tenant = {
      ...mockTenant,
      mails: [
        {
          ...mailSeed,
          id: writtenPayload.mailId,
          createdAt: new Date(),
        },
      ],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should correctly add email by cleaning the address from unwanted characters", async () => {
    const mockTenant: Tenant = getMockTenant();
    const mailSeedWithStrangeCharacters: tenantApi.MailSeed = {
      kind: "CONTACT_EMAIL",
      address: "         test         Mail@test.it",
      description: "mail description",
    };
    await addOneTenant(mockTenant);
    await tenantService.addTenantMail(
      {
        tenantId: mockTenant.id,
        mailSeed: mailSeedWithStrangeCharacters,
      },
      getMockContext({
        authData: getMockAuthData(mockTenant.id),
      })
    );
    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "TenantMailAdded",
      event_version: 2,
    });

    const writtenPayload: TenantMailAddedV2 | undefined = protobufDecoder(
      TenantMailAddedV2
    ).parse(writtenEvent.data);

    const updatedTenant: Tenant = {
      ...mockTenant,
      mails: [
        {
          ...mailSeed,
          id: writtenPayload.mailId,
          createdAt: new Date(),
        },
      ],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should throw tenantNotFound if the tenant doesn't exists", async () => {
    const mockTenant: Tenant = getMockTenant();

    expect(
      tenantService.addTenantMail(
        {
          tenantId: mockTenant.id,
          mailSeed,
        },
        getMockContext({
          authData: getMockAuthData(mockTenant.id),
        })
      )
    ).rejects.toThrowError(tenantNotFound(mockTenant.id));
  });
  it("Should throw operationForbidden when when the requester is trying to assign an email to another tenant", async () => {
    const mockTenant: Tenant = getMockTenant();

    await addOneTenant(mockTenant);
    expect(
      tenantService.addTenantMail(
        {
          tenantId: mockTenant.id,
          mailSeed,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("Should throw mailAlreadyExists if address already exists as the last mail of that kind in the tenant", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      mails: [
        {
          ...mailSeed,
          id: crypto
            .createHash("sha256")
            .update(mailSeed.address)
            .digest("base64"),
          createdAt: new Date(),
        },
      ],
    };

    await addOneTenant(tenant);
    expect(
      tenantService.addTenantMail(
        {
          tenantId: tenant.id,
          mailSeed,
        },
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(mailAlreadyExists());
  });

  it("Should throw notValidMailAddress if the address doesn't respect the valid pattern", async () => {
    const mockTenant: Tenant = getMockTenant();
    const mailSeedWithStrangeCharacters: tenantApi.MailSeed = {
      kind: "CONTACT_EMAIL",
      address: "         test#°¶^            Mail@test.$%*@@it",
      description: "mail description",
    };
    await addOneTenant(mockTenant);
    expect(
      tenantService.addTenantMail(
        {
          tenantId: mockTenant.id,
          mailSeed: mailSeedWithStrangeCharacters,
        },
        getMockContext({
          authData: getMockAuthData(mockTenant.id),
        })
      )
    ).rejects.toThrowError(notValidMailAddress());
  });
});
