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
  TenantCertifiedAttributeAssignedV2,
  tenantAttributeType,
  fromTenantKindV2,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantNotFoundByExternalId,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  postgresDB,
  tenantService,
} from "../integrationUtils.js";

describe("internalAssignCertifiedAttributes", async () => {
  const certifiedAttribute = getMockAttribute();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should add the certified attribute if the Tenant doesn't have it", async () => {
    const targetTenant: Tenant = {
      ...getMockTenant(),
      attributes: [],
    };

    await addOneAttribute(certifiedAttribute);
    await addOneTenant(targetTenant);
    await tenantService.internalAssignCertifiedAttribute(
      {
        tenantOrigin: targetTenant.externalId.origin,
        tenantExternalId: targetTenant.externalId.value,
        attributeOrigin: certifiedAttribute.origin!,
        attributeExternalId: certifiedAttribute.code!,
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
      type: "TenantCertifiedAttributeAssigned",
      event_version: 2,
    });

    const writtenPayload = protobufDecoder(
      TenantCertifiedAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...targetTenant,
      attributes: [
        {
          id: unsafeBrandId(certifiedAttribute.id),
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should re-assign the attribute if it was revoked", async () => {
    const tenantWithCertifiedAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: unsafeBrandId(certifiedAttribute.id),
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };

    await addOneAttribute(certifiedAttribute);
    await addOneTenant(tenantWithCertifiedAttribute);
    await tenantService.internalAssignCertifiedAttribute(
      {
        tenantOrigin: tenantWithCertifiedAttribute.externalId.origin,
        tenantExternalId: tenantWithCertifiedAttribute.externalId.value,
        attributeOrigin: certifiedAttribute.origin!,
        attributeExternalId: certifiedAttribute.code!,
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
      type: "TenantCertifiedAttributeAssigned",
      event_version: 2,
    });

    const writtenPayload = protobufDecoder(
      TenantCertifiedAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithCertifiedAttribute,
      attributes: [
        {
          id: unsafeBrandId(certifiedAttribute.id),
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should throw certifiedAttributeAlreadyAssigned if the attribute was already assigned", async () => {
    const tenantAlreadyAssigned: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: certifiedAttribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
        },
      ],
    };
    await addOneAttribute(certifiedAttribute);
    await addOneTenant(tenantAlreadyAssigned);
    expect(
      tenantService.internalAssignCertifiedAttribute(
        {
          tenantOrigin: tenantAlreadyAssigned.externalId.origin,
          tenantExternalId: tenantAlreadyAssigned.externalId.value,
          attributeOrigin: certifiedAttribute.origin!,
          attributeExternalId: certifiedAttribute.code!,
        },
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      certifiedAttributeAlreadyAssigned(
        unsafeBrandId(certifiedAttribute.id),
        unsafeBrandId(tenantAlreadyAssigned.id)
      )
    );
  });
  it("Should throw tenantNotFoundByExternalId if the target tenant doesn't exist", async () => {
    await addOneAttribute(certifiedAttribute);
    const targetTenant = getMockTenant();
    expect(
      tenantService.internalAssignCertifiedAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantExternalId: targetTenant.externalId.value,
          attributeOrigin: certifiedAttribute.origin!,
          attributeExternalId: certifiedAttribute.code!,
        },
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      tenantNotFoundByExternalId(
        targetTenant.externalId.origin,
        targetTenant.externalId.value
      )
    );
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    const targetTenant: Tenant = getMockTenant();
    await addOneTenant(targetTenant);

    expect(
      tenantService.internalAssignCertifiedAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantExternalId: targetTenant.externalId.value,
          attributeOrigin: certifiedAttribute.origin!,
          attributeExternalId: certifiedAttribute.code!,
        },
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      attributeNotFound(
        unsafeBrandId(`${certifiedAttribute.origin}/${certifiedAttribute.code}`)
      )
    );
  });
});
