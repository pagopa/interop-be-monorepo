/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */

import {
  getMockAttribute,
  getMockTenant,
  readEventByStreamIdAndVersion,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  unsafeBrandId,
  protobufDecoder,
  tenantAttributeType,
  fromTenantKindV2,
  toTenantV2,
  TenantCertifiedDiscreteAttributeAssignedV2,
  TenantCertifiedDiscreteAttributeUpdatedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  addOneAttribute,
  addOneTenant,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

describe("internalAssignCertifiedDiscreteAttribute", async () => {
  const certifiedAttribute = getMockAttribute();
  const mockPopulationValue = 1350000;

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should add the certified discrete attribute with value if the Tenant doesn't have it", async () => {
    const tRemoteOrigin = "ISTAT";
    const tRemoteId = "015146";

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

    await addOneAttribute(certifiedAttribute);
    await addOneTenant(targetTenant);

    await tenantService.internalAssignCertifiedDiscreteAttribute(
      {
        tenantOrigin: tRemoteOrigin,
        tenantRemoteId: tRemoteId,
        attributeOrigin: certifiedAttribute.origin!,
        attributeExternalId: certifiedAttribute.code!,
        value: mockPopulationValue,
      },
      getMockContextInternal({})
    );

    const writtenEvent = await readEventByStreamIdAndVersion(
      targetTenant.id,
      1,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: targetTenant.id,
      version: "1",
      type: "TenantCertifiedDiscreteAttributeAssigned",
      event_version: 2,
    });

    const writtenPayload = protobufDecoder(
      TenantCertifiedDiscreteAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...targetTenant,
      attributes: [
        {
          id: unsafeBrandId(certifiedAttribute.id),
          type: tenantAttributeType.CERTIFIED_DISCRETE,
          assignmentTimestamp: new Date(),
          discreteValue: mockPopulationValue,
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };

    const expectedTenantV2 = toTenantV2(updatedTenant);

    expectedTenantV2.updatedAt = writtenPayload.tenant!.updatedAt;

    expect(writtenPayload).toEqual({
      attributeId: certifiedAttribute.id,
      tenant: expectedTenantV2,
    });
  });

  it("Should update the certified discrete attribute and emit an Updated event if it already exists with a different value", async () => {
    const tRemoteOrigin = "ISTAT";
    const tRemoteId = "015146";
    const oldPopulationValue = 1000000;
    const newPopulationValue = 1350000;

    const tenantAlreadyAssigned: Tenant = {
      ...getMockTenant(),
      remoteIds: [
        {
          origin: tRemoteOrigin,
          value: tRemoteId,
          assignmentTimestamp: new Date(),
        },
      ],
      attributes: [
        {
          id: certifiedAttribute.id,
          type: tenantAttributeType.CERTIFIED_DISCRETE,
          assignmentTimestamp: new Date(),
          discreteValue: oldPopulationValue,
          revocationTimestamp: undefined,
        },
      ],
    };

    await addOneAttribute(certifiedAttribute);
    await addOneTenant(tenantAlreadyAssigned);

    await tenantService.internalAssignCertifiedDiscreteAttribute(
      {
        tenantOrigin: tRemoteOrigin,
        tenantRemoteId: tRemoteId,
        attributeOrigin: certifiedAttribute.origin!,
        attributeExternalId: certifiedAttribute.code!,
        value: newPopulationValue,
      },
      getMockContextInternal({})
    );

    const writtenEvent = await readEventByStreamIdAndVersion(
      tenantAlreadyAssigned.id,
      1,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenantAlreadyAssigned.id,
      version: "1",
      type: "TenantCertifiedDiscreteAttributeUpdated",
      event_version: 2,
    });

    const writtenPayload = protobufDecoder(
      TenantCertifiedDiscreteAttributeUpdatedV2
    ).parse(writtenEvent?.data);

    expect(writtenPayload.previousValue).toBe(oldPopulationValue);
    expect(writtenPayload.newValue).toBe(newPopulationValue);
    expect(writtenPayload.attributeId).toBe(certifiedAttribute.id);
  });

  it("Should skip the update and return the current version if the attribute already exists with the exact same value", async () => {
    const tRemoteOrigin = "ISTAT";
    const tRemoteId = "015146";

    const tenantAlreadyAssigned: Tenant = {
      ...getMockTenant(),
      remoteIds: [
        {
          origin: tRemoteOrigin,
          value: tRemoteId,
          assignmentTimestamp: new Date(),
        },
      ],
      attributes: [
        {
          id: certifiedAttribute.id,
          type: tenantAttributeType.CERTIFIED_DISCRETE,
          assignmentTimestamp: new Date(),
          discreteValue: mockPopulationValue,
          revocationTimestamp: undefined,
        },
      ],
    };

    await addOneAttribute(certifiedAttribute);
    await addOneTenant(tenantAlreadyAssigned);

    const result = await tenantService.internalAssignCertifiedDiscreteAttribute(
      {
        tenantOrigin: tRemoteOrigin,
        tenantRemoteId: tRemoteId,
        attributeOrigin: certifiedAttribute.origin!,
        attributeExternalId: certifiedAttribute.code!,
        value: mockPopulationValue,
      },
      getMockContextInternal({})
    );

    expect(result.version).toBeDefined();

    await expect(
      readEventByStreamIdAndVersion(
        tenantAlreadyAssigned.id,
        1,
        "tenant",
        postgresDB
      )
    ).rejects.toThrow(/No data returned from the query/);
  });
});
