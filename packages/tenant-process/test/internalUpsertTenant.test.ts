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
  TenantOnboardedV2,
  operationForbidden,
  TenantId,
} from "pagopa-interop-models";
import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { ApiInternalTenantSeed } from "../src/model/types.js";
import { getTenantKind } from "../src/services/validators.js";
import { attributeNotFound } from "../src/model/domain/errors.js";
import {
  addOneTenant,
  tenantService,
  readLastTenantEvent,
  getMockTenant,
  attributes,
} from "./utils.js";

describe("internalUpsertTenant", async () => {
  const correlationId = generateId();
  const mockTenant = getMockTenant();
  const mockAuthData = getMockAuthData(generateId<TenantId>());

  const id = generateId();

  const tenantSeed: ApiInternalTenantSeed = {
    externalId: {
      origin: "IPA",
      value: "123456",
    },
    name: "A tenant",
    certifiedAttributes: [{ origin: "ORIGIN", code: "CODE" }],
  };

  const attribute1: Attribute = {
    name: "an Attribute",
    id: unsafeBrandId(id),
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

  it("Should update the tenant if it exists", async () => {
    const authData: AuthData = {
      ...mockAuthData,
      userRoles: ["internal"],
    };

    const attribute2: Attribute = {
      name: "an Attribute",
      id: unsafeBrandId(id),
      kind: "Declared",
      description: "",
      origin: "ORIGIN",
      code: "CODE",
      creationTime: new Date(),
    };

    const tenant: Tenant = {
      ...mockTenant,
      attributes: [
        {
          type: "PersistentCertifiedAttribute",
          id: unsafeBrandId(id),
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };
    await writeInReadmodel(toReadModelAttribute(attribute1), attributes);
    await writeInReadmodel(toReadModelAttribute(attribute2), attributes);

    await addOneTenant(tenant);
    const kind = tenantKind.PA;

    const returnedTenant = await tenantService.internalUpsertTenant(
      tenantSeed,
      {
        authData,
        correlationId,
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
      ...tenant,
      kind,
      updatedAt: new Date(),
      attributes: [
        {
          assignmentTimestamp: new Date(),
          id: unsafeBrandId(id),
          type: "PersistentCertifiedAttribute",
          revocationTimestamp: undefined,
        },
      ],
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
    expect(returnedTenant).toEqual(expectedTenant);
  });
  it("Should create a tenant by the upsert if it does not exist", async () => {
    await writeInReadmodel(toReadModelAttribute(attribute1), attributes);
    const returnedTenant = await tenantService.internalUpsertTenant(
      tenantSeed,
      {
        authData: mockAuthData,
        correlationId,
        serviceName: "",
        logger: genericLogger,
      }
    );
    const writtenEvent = await readLastTenantEvent(
      unsafeBrandId(returnedTenant.id)
    );
    if (!writtenEvent) {
      fail("Creation failed: tenant not found in event-store");
    }
    expect(writtenEvent).toMatchObject({
      stream_id: returnedTenant.id,
      version: "0",
      type: "TenantOnboarded",
    });
    const writtenPayload: TenantOnboardedV2 | undefined = protobufDecoder(
      TenantOnboardedV2
    ).parse(writtenEvent.data);

    const expectedTenant: Tenant = {
      ...mockTenant,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      id: unsafeBrandId(writtenPayload.tenant!.id),
      attributes: [
        {
          type: "PersistentCertifiedAttribute",
          id: unsafeBrandId(id),
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        },
      ],
      name: tenantSeed.name,
      externalId: tenantSeed.externalId,
      kind: getTenantKind([], tenantSeed.externalId),
      selfcareId: mockAuthData.selfcareId,
      onboardedAt: new Date(),
      createdAt: new Date(),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
    expect(returnedTenant).toEqual(expectedTenant);
  });
  it("Should throw operation forbidden if role isn't internal", async () => {
    await writeInReadmodel(toReadModelAttribute(attribute1), attributes);
    await addOneTenant(mockTenant);

    expect(
      tenantService.internalUpsertTenant(tenantSeed, {
        authData: mockAuthData,
        correlationId,
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });
  it("Should throw attributeNotFound error if the attribute doesn't exist", async () => {
    await addOneTenant(mockTenant);

    expect(
      tenantService.internalUpsertTenant(tenantSeed, {
        authData: mockAuthData,
        correlationId,
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
