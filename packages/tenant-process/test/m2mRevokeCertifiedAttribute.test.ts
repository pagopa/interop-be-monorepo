/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockAttribute,
  getMockContextM2M,
  getMockTenant,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  Tenant,
  TenantDeclaredAttributeRevokedV2,
  attributeKind,
  generateId,
  protobufDecoder,
  tenantAttributeType,
  tenantKind,
  toReadModelAttribute,
  toTenantV2,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  attributeNotFound,
  attributeNotFoundInTenant,
  tenantIsNotACertifier,
  tenantNotFound,
  tenantNotFoundByExternalId,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  attributes,
  readLastTenantEvent,
  tenantService,
} from "./utils.js";

describe("m2mRevokeCertifiedAttribute", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the revocation of a certified attribute", async () => {
    const certifierId = generateId();
    const requesterTenant: Tenant = {
      ...getMockTenant(),
      features: [{ certifierId, type: "PersistentCertifier" }],
    };

    const mockAttribute: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.certified,
      origin: certifierId,
      code: generateId(),
    };
    const targetTenant: Tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
      attributes: [
        {
          id: mockAttribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
    };
    await writeInReadmodel(toReadModelAttribute(mockAttribute), attributes);
    await addOneTenant(requesterTenant);
    await addOneTenant(targetTenant);

    await tenantService.m2mRevokeCertifiedAttribute(
      {
        tenantOrigin: targetTenant.externalId.origin,
        tenantExternalId: targetTenant.externalId.value,
        attributeExternalId: mockAttribute.code!,
      },
      getMockContextM2M({
        organizationId: requesterTenant.id,
      })
    );

    const writtenEvent = await readLastTenantEvent(targetTenant.id);
    expect(writtenEvent).toBeDefined();
    expect(writtenEvent.stream_id).toBe(targetTenant.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("TenantCertifiedAttributeRevoked");

    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeRevokedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...targetTenant,
      attributes: [
        {
          id: mockAttribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("should throw tenantNotFound if the requester tenant doesn't exist", async () => {
    const certifierId = generateId();
    const requesterTenant: Tenant = {
      ...getMockTenant(),
      features: [{ certifierId, type: "PersistentCertifier" }],
    };
    const mockAttribute: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.certified,
      origin: certifierId,
      code: generateId(),
    };
    const targetTenant: Tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
      attributes: [
        {
          id: mockAttribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
    };
    await writeInReadmodel(toReadModelAttribute(mockAttribute), attributes);
    await addOneTenant(targetTenant);

    expect(
      tenantService.m2mRevokeCertifiedAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantExternalId: targetTenant.externalId.value,
          attributeExternalId: mockAttribute.code!,
        },
        getMockContextM2M({
          organizationId: requesterTenant.id,
        })
      )
    ).rejects.toThrowError(tenantNotFound(requesterTenant.id));
  });
  it("should throw tenantIsNotACertifier if the requester is not a certifier", async () => {
    const requesterTenant: Tenant = {
      ...getMockTenant(),
      features: [],
    };
    const mockAttribute: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.certified,
      origin: requesterTenant.id,
      code: generateId(),
    };
    const targetTenant: Tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
      attributes: [
        {
          id: mockAttribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
    };
    await writeInReadmodel(toReadModelAttribute(mockAttribute), attributes);
    await addOneTenant(requesterTenant);
    await addOneTenant(targetTenant);

    expect(
      tenantService.m2mRevokeCertifiedAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantExternalId: targetTenant.externalId.value,
          attributeExternalId: mockAttribute.code!,
        },
        getMockContextM2M({
          organizationId: requesterTenant.id,
        })
      )
    ).rejects.toThrowError(tenantIsNotACertifier(requesterTenant.id));
  });
  it("should throw tenantNotFoundByExternalId if the target tenant doesn't exist", async () => {
    const certifierId = generateId();
    const requesterTenant: Tenant = {
      ...getMockTenant(),
      features: [{ certifierId, type: "PersistentCertifier" }],
    };
    const mockAttribute: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.certified,
      origin: certifierId,
      code: generateId(),
    };
    const targetTenant: Tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
      attributes: [
        {
          id: mockAttribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
    };
    await writeInReadmodel(toReadModelAttribute(mockAttribute), attributes);
    await addOneTenant(requesterTenant);

    expect(
      tenantService.m2mRevokeCertifiedAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantExternalId: targetTenant.externalId.value,
          attributeExternalId: mockAttribute.code!,
        },
        getMockContextM2M({
          organizationId: requesterTenant.id,
        })
      )
    ).rejects.toThrowError(
      tenantNotFoundByExternalId(
        targetTenant.externalId.origin,
        targetTenant.externalId.value
      )
    );
  });
  it("should throw attributeNotFound if the attribute doesn't exist", async () => {
    const certifierId = generateId();
    const requesterTenant: Tenant = {
      ...getMockTenant(),
      features: [{ certifierId, type: "PersistentCertifier" }],
    };
    const mockAttribute: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.certified,
      origin: certifierId,
      code: generateId(),
    };
    const targetTenant: Tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
      attributes: [
        {
          id: mockAttribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
    };
    await addOneTenant(requesterTenant);
    await addOneTenant(targetTenant);

    expect(
      tenantService.m2mRevokeCertifiedAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantExternalId: targetTenant.externalId.value,
          attributeExternalId: mockAttribute.code!,
        },
        getMockContextM2M({
          organizationId: requesterTenant.id,
        })
      )
    ).rejects.toThrowError(
      attributeNotFound(`${mockAttribute.origin}/${mockAttribute.code}`)
    );
  });
  it("should throw attributeNotFoundInTenant if the target tenant doesn't have that attribute", async () => {
    const certifierId = generateId();
    const requesterTenant: Tenant = {
      ...getMockTenant(),
      features: [{ certifierId, type: "PersistentCertifier" }],
    };
    const mockAttribute: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.certified,
      origin: certifierId,
      code: generateId(),
    };
    const targetTenant: Tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
      attributes: [],
    };
    await writeInReadmodel(toReadModelAttribute(mockAttribute), attributes);
    await addOneTenant(requesterTenant);
    await addOneTenant(targetTenant);

    expect(
      tenantService.m2mRevokeCertifiedAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantExternalId: targetTenant.externalId.value,
          attributeExternalId: mockAttribute.code!,
        },
        getMockContextM2M({
          organizationId: requesterTenant.id,
        })
      )
    ).rejects.toThrowError(
      attributeNotFoundInTenant(mockAttribute.id, targetTenant.id)
    );
  });
});
