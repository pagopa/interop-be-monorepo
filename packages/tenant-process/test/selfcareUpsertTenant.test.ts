/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  generateId,
  Tenant,
  protobufDecoder,
  operationForbidden,
  tenantKind,
  TenantId,
  unsafeBrandId,
  TenantOnboardDetailsUpdatedV2,
  TenantOnboardedV2,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { selfcareIdConflict } from "../src/model/domain/errors.js";
import { getTenantKind } from "../src/services/validators.js";
import {
  addOneTenant,
  getMockAuthData,
  getMockTenant,
  readLastTenantEvent,
  tenantService,
} from "./utils.js";

describe("selfcareUpsertTenant", async () => {
  const mockTenant = getMockTenant();
  const correlationId = generateId();
  const tenantSeed = {
    externalId: {
      origin: "IPA",
      value: "123456",
    },
    name: "A tenant",
    selfcareId: generateId(),
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should update the tenant if it exists", async () => {
    await addOneTenant(mockTenant);
    const kind = tenantKind.PA;
    const selfcareId = mockTenant.selfcareId!;
    const tenantSeed: tenantApi.SelfcareTenantSeed = {
      externalId: {
        origin: mockTenant.externalId.origin,
        value: mockTenant.externalId.value,
      },
      name: "A tenant",
      selfcareId,
    };
    const mockAuthData = getMockAuthData(mockTenant.id);
    await tenantService.selfcareUpsertTenant(tenantSeed, {
      authData: mockAuthData,
      correlationId,
      serviceName: "",
      logger: genericLogger,
    });

    const writtenEvent = await readLastTenantEvent(mockTenant.id);
    if (!writtenEvent) {
      fail("Update failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "TenantOnboardDetailsUpdated",
    });
    const writtenPayload: TenantOnboardDetailsUpdatedV2 | undefined =
      protobufDecoder(TenantOnboardDetailsUpdatedV2).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...mockTenant,
      selfcareId,
      kind,
      updatedAt: new Date(),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
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
      correlationId,
      serviceName: "",
      logger: genericLogger,
    });
    expect(id).toBeDefined();
    const writtenEvent = await readLastTenantEvent(unsafeBrandId(id));
    if (!writtenEvent) {
      fail("Creation failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: id,
      version: "0",
      type: "TenantOnboarded",
    });
    const writtenPayload: TenantOnboardedV2 | undefined = protobufDecoder(
      TenantOnboardedV2
    ).parse(writtenEvent.data);

    const expectedTenant: Tenant = {
      ...mockTenant,
      externalId: tenantSeed.externalId,
      id: unsafeBrandId(id),
      kind: getTenantKind([], tenantSeed.externalId),
      selfcareId: tenantSeed.selfcareId,
      onboardedAt: new Date(),
      createdAt: new Date(),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
  });
  it("Should throw operation forbidden if role isn't internal", async () => {
    await addOneTenant(mockTenant);
    const mockAuthData = getMockAuthData(generateId<TenantId>());

    expect(
      tenantService.selfcareUpsertTenant(tenantSeed, {
        authData: mockAuthData,
        correlationId,
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
        correlationId,
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
