/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  generateId,
  Tenant,
  protobufDecoder,
  toTenantV2,
  operationForbidden,
  TenantMailDeletedV2,
  TenantId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import {
  getMockAuthData,
  getMockContext,
  getMockTenant,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { mailNotFound, tenantNotFound } from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

describe("deleteTenantMailById", async () => {
  const mailId = generateId();
  const notDeletedMailId = generateId();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });
  it("Should delete the mail with the required mailId if it exist ", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      mails: [
        {
          id: mailId,
          createdAt: new Date(),
          kind: "CONTACT_EMAIL",
          address: "testMail@test.it",
        },
        {
          id: notDeletedMailId,
          createdAt: new Date(),
          kind: "CONTACT_EMAIL",
          address: "testMail2@test.it",
        },
      ],
    };

    await addOneTenant(tenant);
    await tenantService.deleteTenantMailById(
      {
        tenantId: tenant.id,
        mailId,
      },
      getMockContext({
        authData: getMockAuthData(tenant.id),
      })
    );
    const writtenEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "1",
      type: "TenantMailDeleted",
      event_version: 2,
    });

    const writtenPayload: TenantMailDeletedV2 | undefined = protobufDecoder(
      TenantMailDeletedV2
    ).parse(writtenEvent.data);

    const updatedTenant: Tenant = {
      ...tenant,
      mails: [
        {
          id: notDeletedMailId,
          createdAt: new Date(),
          kind: "CONTACT_EMAIL",
          address: "testMail2@test.it",
        },
      ],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should throw tenantNotFound if the tenant doesn't exists", async () => {
    await addOneTenant(getMockTenant());
    const tenantId: TenantId = generateId();
    expect(
      tenantService.deleteTenantMailById(
        {
          tenantId,
          mailId,
        },
        getMockContext({
          authData: getMockAuthData(tenantId),
        })
      )
    ).rejects.toThrowError(tenantNotFound(tenantId));
  });
  it("Should throw operationForbidden when tenantId is not the organizationId", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      mails: [
        {
          id: mailId,
          createdAt: new Date(),
          kind: "CONTACT_EMAIL",
          address: "testMail@test.it",
        },
      ],
    };

    await addOneTenant(tenant);
    expect(
      tenantService.deleteTenantMailById(
        {
          tenantId: tenant.id,
          mailId,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("Should throw mailNotFound if that mail doesn't exist in the tenant", async () => {
    const tenant: Tenant = {
      ...getMockTenant(),
      mails: [
        {
          id: mailId,
          createdAt: new Date(),
          kind: "CONTACT_EMAIL",
          address: "testMail@test.it",
        },
      ],
    };
    await addOneTenant(tenant);
    const mailIdNotInTenant = generateId();
    expect(
      tenantService.deleteTenantMailById(
        {
          tenantId: tenant.id,
          mailId: mailIdNotInTenant,
        },
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(mailNotFound(mailIdNotInTenant));
  });
});
