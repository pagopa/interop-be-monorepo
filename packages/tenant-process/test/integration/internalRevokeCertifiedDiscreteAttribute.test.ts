/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockAttribute,
  getMockTenant,
  readEventByStreamIdAndVersion,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  unsafeBrandId,
  protobufDecoder,
  fromTenantKindV2,
  toTenantV2,
  tenantAttributeType,
  TenantCertifiedDiscreteAttributeRevokedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";

import {
  attributeNotFound,
  attributeNotFoundInTenant,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  tenantService,
  postgresDB,
} from "../integrationUtils.js";

describe("testInternalRevokeCertifiedDiscreteAttribute", async () => {
  const tRemoteOrigin = "ISTAT";
  const tRemoteId = "015146";

  const requesterTenant: Tenant = {
    ...getMockTenant(),
    features: [
      {
        type: "PersistentCertifier",
        certifierId: generateId(),
      },
    ],
    remoteIds: [
      {
        origin: tRemoteOrigin,
        value: tRemoteId,
        assignmentTimestamp: new Date(),
      },
    ],
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should revoke the certified discrete attribute if it exists", async () => {
    const mockAttribute = getMockAttribute();
    const mockPopulationValue = 1000000;

    const tenantWithCertifiedAttribute: Tenant = {
      ...requesterTenant,
      attributes: [
        {
          id: unsafeBrandId(mockAttribute.id),
          type: tenantAttributeType.CERTIFIED_DISCRETE,
          assignmentTimestamp: new Date(),
          discreteValue: mockPopulationValue,
          revocationTimestamp: undefined,
        },
      ],
    };

    await addOneAttribute(mockAttribute);
    await addOneTenant(tenantWithCertifiedAttribute);

    await tenantService.internalRevokeCertifiedDiscreteAttribute(
      {
        tenantOrigin: tRemoteOrigin,
        tenantRemoteId: tRemoteId,
        attributeOrigin: mockAttribute.origin!,
        attributeExternalId: mockAttribute.code!,
      },
      getMockContextInternal({})
    );

    const writtenEvent = await readEventByStreamIdAndVersion(
      tenantWithCertifiedAttribute.id,
      1,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenantWithCertifiedAttribute.id,
      version: "1",
      type: "TenantCertifiedDiscreteAttributeRevoked",
      event_version: 2,
    });

    const writtenPayload = protobufDecoder(
      TenantCertifiedDiscreteAttributeRevokedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithCertifiedAttribute,
      attributes: [
        {
          id: unsafeBrandId(mockAttribute.id),
          type: tenantAttributeType.CERTIFIED_DISCRETE,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
          discreteValue: mockPopulationValue,
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };

    const expectedTenantV2 = toTenantV2(updatedTenant);

    expectedTenantV2.updatedAt = writtenPayload.tenant!.updatedAt;

    expect(writtenPayload).toEqual({
      attributeId: mockAttribute.id,
      tenant: expectedTenantV2,
    });
  });

  it("should throw tenantNotFound if the target tenant doesn't exist", async () => {
    const mockAttribute = getMockAttribute();
    await addOneAttribute(mockAttribute);
    const targetTenant = getMockTenant();

    await expect(
      tenantService.internalRevokeCertifiedDiscreteAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantRemoteId: "999999",
          attributeOrigin: mockAttribute.origin!,
          attributeExternalId: mockAttribute.code!,
        },
        getMockContextInternal({})
      )
    ).rejects.toThrow();
  });

  it("should throw attributeNotFound if the attribute doesn't exist", async () => {
    const mockAttribute = getMockAttribute();
    await addOneTenant(requesterTenant);

    await expect(
      tenantService.internalRevokeCertifiedDiscreteAttribute(
        {
          tenantOrigin: tRemoteOrigin,
          tenantRemoteId: tRemoteId,
          attributeOrigin: mockAttribute.origin!,
          attributeExternalId: mockAttribute.code!,
        },
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      attributeNotFound(
        unsafeBrandId(`${mockAttribute.origin}/${mockAttribute.code}`)
      )
    );
  });

  it("should throw attributeNotFoundInTenant if the target tenant doesn't have that attribute", async () => {
    const mockAttribute = getMockAttribute();
    const targetTenant: Tenant = {
      ...getMockTenant(),
      attributes: [],
      remoteIds: [
        {
          origin: tRemoteOrigin,
          value: tRemoteId,
          assignmentTimestamp: new Date(),
        },
      ],
    };

    await addOneTenant(targetTenant);
    await addOneAttribute(mockAttribute);

    await expect(
      tenantService.internalRevokeCertifiedDiscreteAttribute(
        {
          tenantOrigin: tRemoteOrigin,
          tenantRemoteId: tRemoteId,
          attributeOrigin: mockAttribute.origin!,
          attributeExternalId: mockAttribute.code!,
        },
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      attributeNotFoundInTenant(mockAttribute.id, targetTenant.id)
    );
  });
});
