/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { AuthData, genericLogger } from "pagopa-interop-commons";
import {
  getMockAuthData,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  generateId,
  tenantKind,
  TenantOnboardDetailsUpdatedV2,
  protobufDecoder,
  Tenant,
  toTenantV2,
  Attribute,
  unsafeBrandId,
  toReadModelAttribute,
} from "pagopa-interop-models";
import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  tenantService,
  readLastTenantEvent,
  getMockTenant,
  attributes,
} from "./utils.js";

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
    const mockTenant = getMockTenant();

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["internal"],
    };

    await writeInReadmodel(toReadModelAttribute(attribute1), attributes);
    await addOneTenant(mockTenant);
    const returnedTenant = await tenantService.internalUpsertTenant(
      tenantSeed,
      {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );
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

    const expectedTenant: Tenant = {
      ...mockTenant,
      kind: tenantKind.PA,
      updatedAt: new Date(),
      attributes: [
        {
          assignmentTimestamp: new Date(),
          id: attribute1.id,
          type: "PersistentCertifiedAttribute",
          revocationTimestamp: undefined,
        },
      ],
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
    expect(returnedTenant).toEqual(expectedTenant);
  });

  it("Should re-assign the attributes if they were revoked", async () => {
    const mockTenant = getMockTenant();

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["internal"],
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

    await writeInReadmodel(toReadModelAttribute(attribute1), attributes);
    await writeInReadmodel(toReadModelAttribute(attribute2), attributes);

    const tenant: Tenant = {
      ...mockTenant,
      attributes: [
        {
          type: "PersistentCertifiedAttribute",
          id: attribute1.id,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
        {
          type: "PersistentCertifiedAttribute",
          id: attribute2.id,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };

    await addOneTenant(tenant);

    const returnedTenant = await tenantService.internalUpsertTenant(
      tenantSeed2,
      {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    const writtenEvent = await readLastTenantEvent(tenant.id);
    if (!writtenEvent) {
      fail("Update failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "1",
      type: "TenantOnboardDetailsUpdated",
    });
    const writtenPayload: TenantOnboardDetailsUpdatedV2 | undefined =
      protobufDecoder(TenantOnboardDetailsUpdatedV2).parse(writtenEvent?.data);

    const expectedTenant: Tenant = {
      ...mockTenant,
      kind: tenantKind.PA,
      updatedAt: new Date(),
      attributes: [
        {
          assignmentTimestamp: new Date(),
          id: attribute1.id,
          type: "PersistentCertifiedAttribute",
          revocationTimestamp: undefined,
        },
        {
          assignmentTimestamp: new Date(),
          id: attribute2.id,
          type: "PersistentCertifiedAttribute",
          revocationTimestamp: undefined,
        },
      ],
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
    expect(returnedTenant).toEqual(expectedTenant);
  });
  it("Should throw certifiedAttributeAlreadyAssigned if the attribute was already assigned", async () => {
    const tenantAlreadyAssigned: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: attribute1.id,
          type: "PersistentCertifiedAttribute",
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        },
      ],
    };

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: tenantAlreadyAssigned.id,
      userRoles: ["internal"],
    };

    await writeInReadmodel(toReadModelAttribute(attribute1), attributes);
    await addOneTenant(tenantAlreadyAssigned);
    expect(
      tenantService.internalUpsertTenant(tenantSeed, {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      certifiedAttributeAlreadyAssigned(
        unsafeBrandId(attribute1.id),
        unsafeBrandId(tenantAlreadyAssigned.id)
      )
    );
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    const mockTenant = getMockTenant();

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["internal"],
    };
    await writeInReadmodel(toReadModelAttribute(attribute1), attributes);
    expect(
      tenantService.internalUpsertTenant(tenantSeed, {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      tenantNotFound(
        unsafeBrandId(
          `${mockTenant.externalId.origin}/${mockTenant.externalId.value}`
        )
      )
    );
  });
  it("Should throw attributeNotFound error if the attribute doesn't exist", async () => {
    const mockTenant = getMockTenant();

    const authData: AuthData = {
      ...getMockAuthData(),
      organizationId: mockTenant.id,
      userRoles: ["internal"],
    };
    await addOneTenant(mockTenant);

    expect(
      tenantService.internalUpsertTenant(tenantSeed, {
        authData,
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      attributeNotFound(
        `${tenantSeed.certifiedAttributes[0].origin}/${tenantSeed.certifiedAttributes[0].code}`
      )
    );
  });
});
