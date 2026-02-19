/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  getMockContextInternal,
  getMockTenant,
  readEventByStreamIdAndVersion,
  sortTenant,
} from "pagopa-interop-commons-test";
import {
  generateId,
  tenantKind,
  protobufDecoder,
  Tenant,
  toTenantV2,
  Attribute,
  unsafeBrandId,
  TenantCertifiedAttributeAssignedV2,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantNotFoundByExternalId,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  tenantService,
  readLastTenantEvent,
  postgresDB,
} from "../integrationUtils.js";

describe("internalUpsertTenant", async () => {
  const tenantSeed: tenantApi.InternalTenantSeed = {
    externalId: {
      origin: "IPA",
      value: "123456",
    },
    name: "A tenant",
    certifiedAttributes: [{ origin: "ORIGIN", code: "CODE" }],
  };

  const attribute1: Attribute = {
    name: "an Attribute",
    id: generateId(),
    kind: "Certified",
    description: "",
    origin: "ORIGIN",
    code: "CODE",
    creationTime: new Date(),
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });
  it("Should add the certified attribute if the Tenant doesn't have it", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
    };

    await addOneAttribute(attribute1);
    await addOneTenant(mockTenant);
    const returnedTenant = await tenantService.internalUpsertTenant(
      tenantSeed,
      getMockContextInternal({})
    );
    const writtenEvent = await readEventByStreamIdAndVersion(
      mockTenant.id,
      1,
      "tenant",
      postgresDB
    );
    if (!writtenEvent) {
      fail("Update failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "TenantCertifiedAttributeAssigned",
    });
    const writtenPayload: TenantCertifiedAttributeAssignedV2 | undefined =
      protobufDecoder(TenantCertifiedAttributeAssignedV2).parse(
        writtenEvent?.data
      );

    const expectedTenant: Tenant = {
      ...mockTenant,
      kind: tenantKind.PA,
      updatedAt: new Date(),
      attributes: [
        {
          assignmentTimestamp: new Date(),
          id: attribute1.id,
          type: tenantAttributeType.CERTIFIED,
          revocationTimestamp: undefined,
        },
      ],
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
    expect(returnedTenant.data).toEqual(expectedTenant);
    expect(returnedTenant.metadata.version).toBe(1);
  });

  it("Should re-assign the attributes if they were revoked", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
    };

    const tenantSeed2: tenantApi.InternalTenantSeed = {
      ...tenantSeed,
      certifiedAttributes: [
        ...tenantSeed.certifiedAttributes,
        { origin: "ORIGIN 2", code: "CODE 2" },
      ],
    };

    const attribute2: Attribute = {
      name: "an Attribute 2",
      id: generateId(),
      kind: "Certified",
      description: "",
      origin: "ORIGIN 2",
      code: "CODE 2",
      creationTime: new Date(),
    };

    await addOneAttribute(attribute1);
    await addOneAttribute(attribute2);

    const tenant: Tenant = {
      ...mockTenant,
      attributes: [
        {
          type: tenantAttributeType.CERTIFIED,
          id: attribute1.id,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
        {
          type: tenantAttributeType.CERTIFIED,
          id: attribute2.id,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };

    await addOneTenant(tenant);

    const returnedTenant = await tenantService.internalUpsertTenant(
      tenantSeed2,
      getMockContextInternal({})
    );

    const writtenEvent = await readLastTenantEvent(mockTenant.id);
    if (!writtenEvent) {
      fail("Update failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "2",
      type: "TenantCertifiedAttributeAssigned",
    });
    const writtenPayload: TenantCertifiedAttributeAssignedV2 | undefined =
      protobufDecoder(TenantCertifiedAttributeAssignedV2).parse(
        writtenEvent?.data
      );

    const expectedTenant: Tenant = {
      ...mockTenant,
      kind: tenantKind.PA,
      updatedAt: new Date(),
      attributes: [
        {
          assignmentTimestamp: new Date(),
          id: attribute1.id,
          type: tenantAttributeType.CERTIFIED,
          revocationTimestamp: undefined,
        },
        {
          assignmentTimestamp: new Date(),
          id: attribute2.id,
          type: tenantAttributeType.CERTIFIED,
          revocationTimestamp: undefined,
        },
      ],
    };

    const tenantV2 = toTenantV2(expectedTenant);
    expect(writtenPayload.tenant).toEqual({
      ...tenantV2,
      attributes: expect.arrayContaining(tenantV2.attributes),
    });
    expect(sortTenant(returnedTenant.data)).toEqual(sortTenant(expectedTenant));
    expect(returnedTenant.metadata.version).toBe(2);
  });
  it("Should throw certifiedAttributeAlreadyAssigned if the attribute was already assigned", async () => {
    const tenantAlreadyAssigned: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: attribute1.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        },
      ],
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
    };

    await addOneAttribute(attribute1);
    await addOneTenant(tenantAlreadyAssigned);
    expect(
      tenantService.internalUpsertTenant(tenantSeed, getMockContextInternal({}))
    ).rejects.toThrowError(
      certifiedAttributeAlreadyAssigned(
        unsafeBrandId(attribute1.id),
        unsafeBrandId(tenantAlreadyAssigned.id)
      )
    );
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
    };

    await addOneAttribute(attribute1);
    expect(
      tenantService.internalUpsertTenant(tenantSeed, getMockContextInternal({}))
    ).rejects.toThrowError(
      tenantNotFoundByExternalId(
        mockTenant.externalId.origin,
        mockTenant.externalId.value
      )
    );
  });
  it("Should throw attributeNotFound error if the attribute doesn't exist", async () => {
    const mockTenant: Tenant = {
      ...getMockTenant(),
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      kind: tenantKind.PA,
    };

    await addOneTenant(mockTenant);

    expect(
      tenantService.internalUpsertTenant(tenantSeed, getMockContextInternal({}))
    ).rejects.toThrowError(
      attributeNotFound(
        `${tenantSeed.certifiedAttributes[0].origin}/${tenantSeed.certifiedAttributes[0].code}`
      )
    );
  });
});
