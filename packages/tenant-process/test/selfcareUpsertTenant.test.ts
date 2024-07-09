/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  generateId,
  Tenant,
  protobufDecoder,
  operationForbidden,
  tenantKind,
  TenantUpdatedV1,
  TenantId,
  TenantCreatedV1,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/dist/eventStoreTestUtils.js";
import { ApiSelfcareTenantSeed } from "../src/model/types.js";
import { selfcareIdConflict } from "../src/model/domain/errors.js";
import { toTenantV1 } from "../src/model/domain/toEvent.js";
import { getTenantKind } from "../src/services/validators.js";
import {
  addOneTenant,
  getMockAuthData,
  getMockTenant,
  postgresDB,
  tenantService,
} from "./utils.js";

describe("selfcareUpsertTenant", async () => {
  const mockTenant = getMockTenant();
  const tenantSeed = {
    externalId: {
      origin: "IPA",
      value: "123456",
    },
    name: "A tenant",
    selfcareId: generateId(),
  };
  const tenant: Tenant = {
    ...mockTenant,
    selfcareId: undefined,
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });
  it("Should update the tenant if it exists", async () => {
    await addOneTenant(tenant);
    const kind = tenantKind.PA;
    const selfcareId = generateId();
    const tenantSeed: ApiSelfcareTenantSeed = {
      externalId: {
        origin: tenant.externalId.origin,
        value: tenant.externalId.value,
      },
      name: "A tenant",
      selfcareId,
    };
    const mockAuthData = getMockAuthData(tenant.id);
    await tenantService.selfcareUpsertTenant(tenantSeed, {
      authData: mockAuthData,
      correlationId: generateId(),
      serviceName: "",
      logger: genericLogger,
    });

    const writtenEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );
    if (!writtenEvent) {
      fail("Update failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "1",
      type: "TenantUpdated",
    });
    const writtenPayload: TenantUpdatedV1 | undefined = protobufDecoder(
      TenantUpdatedV1
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenant,
      selfcareId,
      kind,
      updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV1(updatedTenant));
  });
  it("Should create a tenant by the upsert if it does not exist", async () => {
    const mockAuthData = getMockAuthData();
    const tenantSeed = {
      externalId: {
        origin: "Nothing",
        value: "0",
      },
      name: "A tenant",
      selfcareId: generateId(),
    };
    const id = await tenantService.selfcareUpsertTenant(tenantSeed, {
      authData: mockAuthData,
      correlationId: generateId(),
      serviceName: "",
      logger: genericLogger,
    });

    const writtenEvent = await readLastEventByStreamId(
      unsafeBrandId<TenantId>(id),
      "tenant",
      postgresDB
    );
    if (!writtenEvent) {
      fail("Creation failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: id,
      version: "0",
      type: "TenantCreated",
    });
    const writtenPayload: TenantCreatedV1 | undefined = protobufDecoder(
      TenantCreatedV1
    ).parse(writtenEvent.data);
    const expectedTenant: Tenant = {
      ...mockTenant,
      externalId: tenantSeed.externalId,
      id: unsafeBrandId(id),
      kind: getTenantKind([], tenantSeed.externalId),
      selfcareId: tenantSeed.selfcareId,
      createdAt: new Date(Number(writtenPayload.tenant?.createdAt)),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV1(expectedTenant));
  });
  it("Should throw operation forbidden if role isn't internal", async () => {
    await addOneTenant(tenant);
    const mockAuthData = getMockAuthData(generateId<TenantId>());

    expect(
      tenantService.selfcareUpsertTenant(tenantSeed, {
        authData: mockAuthData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });
  it("Should throw selfcareIdConflict error if the given and existing selfcareId differs", async () => {
    const tenant: Tenant = {
      ...mockTenant,
      selfcareId: generateId(),
    };
    await addOneTenant(tenant);
    const newTenantSeed = {
      ...tenantSeed,
      selfcareId: generateId(),
    };
    const mockAuthData = getMockAuthData(tenant.id);
    expect(
      tenantService.selfcareUpsertTenant(newTenantSeed, {
        authData: mockAuthData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      selfcareIdConflict({
        tenantId: tenant.id,
        existingSelfcareId: tenant.selfcareId!,
        newSelfcareId: newTenantSeed.selfcareId,
      })
    );
  });
});
