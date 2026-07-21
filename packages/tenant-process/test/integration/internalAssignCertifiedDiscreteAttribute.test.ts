/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockAttribute,
  getMockTenant,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  unsafeBrandId,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

import { certifiedDiscreteAttributeAlreadyAssigned } from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  tenantService,
} from "../integrationUtils.js";

describe("internalAssignCertifiedDiscreteAttribute", () => {
  const certifiedAttribute = getMockAttribute();
  const mockPopulationValue = 1350000;

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should add the certified discrete attribute if the Tenant doesn't have it", async () => {
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

    expect(result).toBeDefined();
  });

  it("Should throw 409 if attribute already exists", async () => {
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
          discreteValue: 100,
          revocationTimestamp: undefined,
        },
      ],
    };

    await addOneAttribute(certifiedAttribute);
    await addOneTenant(tenantAlreadyAssigned);

    await expect(
      tenantService.internalAssignCertifiedDiscreteAttribute(
        {
          tenantOrigin: tRemoteOrigin,
          tenantRemoteId: tRemoteId,
          attributeOrigin: certifiedAttribute.origin!,
          attributeExternalId: certifiedAttribute.code!,
          value: 200,
        },
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      certifiedDiscreteAttributeAlreadyAssigned(
        unsafeBrandId(certifiedAttribute.id),
        unsafeBrandId(tenantAlreadyAssigned.id)
      )
    );
  });
});
