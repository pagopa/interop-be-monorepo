/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { tenantApi } from "pagopa-interop-api-clients";
import {
  getMockAttribute,
  getMockTenant,
  readEventByStreamIdAndVersion,
  getMockAuthData,
  getTenantOneCertifierFeature,
  getMockContext,
  getMockCertifiedDiscreteTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  tenantKind,
  generateId,
  Tenant,
  Attribute,
  protobufDecoder,
  fromTenantKindV2,
  toTenantV2,
  TenantCertifiedDiscreteAttributeUpdatedV2,
  attributeKind,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

import {
  tenantNotFound,
  attributeNotFound,
  tenantIsNotACertifier,
  attributeDoesNotBelongToCertifier,
  certifiedDiscreteAttributeRevoked,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  tenantService,
  postgresDB,
} from "../integrationUtils.js";

describe("updateCertifiedDiscreteAttributeById", async () => {
  const requesterTenant: Tenant = {
    ...getMockTenant(),
    features: [
      {
        type: "PersistentCertifier",
        certifierId: generateId(),
      },
    ],
  };
  const authData = getMockAuthData(requesterTenant.id);

  const attribute: Attribute = {
    ...getMockAttribute(attributeKind.certifiedDiscrete),
    origin: getTenantOneCertifierFeature(requesterTenant).certifierId,
  };

  const tenantAttributeSeed: tenantApi.UpdateCertifiedDiscreteTenantAttributeSeed =
    {
      certifiedDiscreteValue: 2000,
    };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should update the certified discrete attribute if it exists with a different value", async () => {
    const tenantWithCertifiedDiscreteAttribute: Tenant = {
      ...getMockTenant(),
      kind: tenantKind.PA,
      attributes: [
        {
          ...getMockCertifiedDiscreteTenantAttribute(),
          id: attribute.id,
          discreteValue: 1000,
        },
      ],
    };

    await addOneAttribute(attribute);
    await addOneTenant(tenantWithCertifiedDiscreteAttribute);
    await addOneTenant(requesterTenant);

    const updateCertifiedDiscreteAttributeByIdResponse =
      await tenantService.updateCertifiedDiscreteAttributeById(
        {
          tenantId: tenantWithCertifiedDiscreteAttribute.id,
          attributeId: attribute.id,
          tenantAttributeSeed,
        },
        getMockContext({ authData })
      );
    const writtenEvent = await readEventByStreamIdAndVersion(
      updateCertifiedDiscreteAttributeByIdResponse.data.id,
      1,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: updateCertifiedDiscreteAttributeByIdResponse.data.id,
      version: "1",
      type: "TenantCertifiedDiscreteAttributeUpdated",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantCertifiedDiscreteAttributeUpdatedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithCertifiedDiscreteAttribute,
      attributes: [
        {
          ...getMockCertifiedDiscreteTenantAttribute(),
          id: attribute.id,
          discreteValue: tenantAttributeSeed.certifiedDiscreteValue,
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload).toEqual({
      attributeId: attribute.id,
      tenant: toTenantV2(updatedTenant),
      previousValue: 1000,
      newValue: tenantAttributeSeed.certifiedDiscreteValue,
    });

    expect(updateCertifiedDiscreteAttributeByIdResponse).toEqual({
      data: updatedTenant,
      metadata: { version: 1 },
    });
  });

  it("Should not write any event if the value is identical", async () => {
    const tenantWithCertifiedDiscreteAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          ...getMockCertifiedDiscreteTenantAttribute(),
          id: attribute.id,
          discreteValue: tenantAttributeSeed.certifiedDiscreteValue,
        },
      ],
    };

    await addOneAttribute(attribute);
    await addOneTenant(tenantWithCertifiedDiscreteAttribute);
    await addOneTenant(requesterTenant);

    const updateCertifiedDiscreteAttributeByIdResponse =
      await tenantService.updateCertifiedDiscreteAttributeById(
        {
          tenantId: tenantWithCertifiedDiscreteAttribute.id,
          attributeId: attribute.id,
          tenantAttributeSeed,
        },
        getMockContext({ authData })
      );

    expect(updateCertifiedDiscreteAttributeByIdResponse).toEqual({
      data: tenantWithCertifiedDiscreteAttribute,
      metadata: { version: 0 },
    });
    await expect(
      readEventByStreamIdAndVersion(
        tenantWithCertifiedDiscreteAttribute.id,
        1,
        "tenant",
        postgresDB
      )
    ).rejects.toThrow();
  });

  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    await addOneAttribute(attribute);
    expect(
      tenantService.updateCertifiedDiscreteAttributeById(
        {
          tenantId: getMockTenant().id,
          attributeId: attribute.id,
          tenantAttributeSeed,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrow(tenantNotFound(requesterTenant.id));
  });

  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    const targetTenant = getMockTenant();
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);

    expect(
      tenantService.updateCertifiedDiscreteAttributeById(
        {
          tenantId: targetTenant.id,
          attributeId: attribute.id,
          tenantAttributeSeed,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrow(attributeNotFound(attribute.id));
  });

  it("Should throw attributeNotFound if the attribute is not assigned to the target tenant", async () => {
    const targetTenant = getMockTenant();
    await addOneAttribute(attribute);
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);

    expect(
      tenantService.updateCertifiedDiscreteAttributeById(
        {
          tenantId: targetTenant.id,
          attributeId: attribute.id,
          tenantAttributeSeed,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrow(attributeNotFound(attribute.id));
  });

  it("Should throw tenantIsNotACertifier if the requester is not a certifier", async () => {
    const targetTenant = getMockTenant();
    const notCertifierTenant: Tenant = {
      ...getMockTenant(),
    };
    const authData = getMockAuthData(notCertifierTenant.id);

    await addOneAttribute(attribute);
    await addOneTenant(targetTenant);
    await addOneTenant(notCertifierTenant);

    expect(
      tenantService.updateCertifiedDiscreteAttributeById(
        {
          tenantId: targetTenant.id,
          attributeId: attribute.id,
          tenantAttributeSeed,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrow(tenantIsNotACertifier(notCertifierTenant.id));
  });

  it("Should throw attributeDoesNotBelongToCertifier if attribute origin doesn't match the certifierId of the requester", async () => {
    const targetTenant = getMockTenant();
    const notCompliantOriginAttribute: Attribute = {
      ...attribute,
      origin: generateId(),
    };
    await addOneAttribute(notCompliantOriginAttribute);
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);

    expect(
      tenantService.updateCertifiedDiscreteAttributeById(
        {
          tenantId: targetTenant.id,
          attributeId: notCompliantOriginAttribute.id,
          tenantAttributeSeed,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrow(
      attributeDoesNotBelongToCertifier(
        notCompliantOriginAttribute.id,
        requesterTenant.id,
        targetTenant.id
      )
    );
  });

  it("Should throw certifiedDiscreteAttributeRevoked if the attribute was already revoked", async () => {
    const tenantWithRevokedAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          ...getMockCertifiedDiscreteTenantAttribute(),
          id: attribute.id,
          revocationTimestamp: new Date(),
        },
      ],
    };
    await addOneAttribute(attribute);
    await addOneTenant(tenantWithRevokedAttribute);
    await addOneTenant(requesterTenant);

    expect(
      tenantService.updateCertifiedDiscreteAttributeById(
        {
          tenantId: tenantWithRevokedAttribute.id,
          attributeId: attribute.id,
          tenantAttributeSeed,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrow(
      certifiedDiscreteAttributeRevoked(
        tenantWithRevokedAttribute.id,
        attribute.id
      )
    );
  });
});
