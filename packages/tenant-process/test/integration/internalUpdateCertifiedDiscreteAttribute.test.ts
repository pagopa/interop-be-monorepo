/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockAttribute,
  getMockTenant,
  readEventByStreamIdAndVersion,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import { Tenant, tenantAttributeType } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  addOneAttribute,
  addOneTenant,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

describe("internalUpdateCertifiedDiscreteAttribute", () => {
  const certifiedDiscreteAttribute = getMockAttribute();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should update the attribute if it exists with a different value", async () => {
    const tRemoteOrigin = "ISTAT";
    const tRemoteId = "015146";
    const oldVal = 1000,
      newVal = 2000;

    const tenant: Tenant = {
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
          id: certifiedDiscreteAttribute.id,
          type: tenantAttributeType.CERTIFIED_DISCRETE,
          assignmentTimestamp: new Date(),
          discreteValue: oldVal,
          revocationTimestamp: undefined,
        },
      ],
    };

    await addOneAttribute(certifiedDiscreteAttribute);
    await addOneTenant(tenant);

    await tenantService.internalUpdateCertifiedDiscreteAttribute(
      {
        tenantOrigin: tRemoteOrigin,
        tenantRemoteId: tRemoteId,
        attributeOrigin: certifiedDiscreteAttribute.origin!,
        attributeExternalId: certifiedDiscreteAttribute.code!,
        value: newVal,
      },
      getMockContextInternal({})
    );

    const writtenEvent = await readEventByStreamIdAndVersion(
      tenant.id,
      1,
      "tenant",
      postgresDB
    );
    expect(writtenEvent.type).toBe("TenantCertifiedDiscreteAttributeUpdated");
  });

  it("Should skip update if value is identical", async () => {
    const tRemoteOrigin = "ISTAT";
    const tRemoteId = "015146";
    const val = 1000;

    const tenant: Tenant = {
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
          id: certifiedDiscreteAttribute.id,
          type: tenantAttributeType.CERTIFIED_DISCRETE,
          assignmentTimestamp: new Date(),
          discreteValue: val,
          revocationTimestamp: undefined,
        },
      ],
    };

    await addOneAttribute(certifiedDiscreteAttribute);
    await addOneTenant(tenant);

    const result = await tenantService.internalUpdateCertifiedDiscreteAttribute(
      {
        tenantOrigin: tRemoteOrigin,
        tenantRemoteId: tRemoteId,
        attributeOrigin: certifiedDiscreteAttribute.origin!,
        attributeExternalId: certifiedDiscreteAttribute.code!,
        value: val,
      },
      getMockContextInternal({})
    );

    expect(result.version).toBeDefined();
    await expect(
      readEventByStreamIdAndVersion(tenant.id, 1, "tenant", postgresDB)
    ).rejects.toThrow();
  });
});
