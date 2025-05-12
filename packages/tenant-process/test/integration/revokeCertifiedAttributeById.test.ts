/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { attributeKind, tenantAttributeType } from "pagopa-interop-models";
import {
  generateId,
  Tenant,
  Attribute,
  protobufDecoder,
  fromTenantKindV2,
  toTenantV2,
  TenantCertifiedAttributeRevokedV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  getMockAttribute,
  getMockTenant,
  readEventByStreamIdAndVersion,
  getMockAuthData,
  getTenantOneCertifierFeature,
  getMockContext,
} from "pagopa-interop-commons-test";
import {
  tenantNotFound,
  attributeNotFound,
  tenantIsNotACertifier,
  attributeDoesNotBelongToCertifier,
  attributeAlreadyRevoked,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  tenantService,
  postgresDB,
} from "../integrationUtils.js";
import { getMockCertifiedTenantAttribute } from "../mockUtils.js";

describe("revokeCertifiedAttributeById", async () => {
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
    ...getMockAttribute(),
    kind: attributeKind.certified,
    origin: getTenantOneCertifierFeature(requesterTenant).certifierId,
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should revoke the certified attribute if it exist", async () => {
    const tenantWithCertifiedAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(),
          id: attribute.id,
          assignmentTimestamp: new Date(),
        },
      ],
    };

    await addOneAttribute(attribute);
    await addOneTenant(tenantWithCertifiedAttribute);
    await addOneTenant(requesterTenant);
    await tenantService.revokeCertifiedAttributeById(
      {
        tenantId: tenantWithCertifiedAttribute.id,
        attributeId: attribute.id,
      },
      getMockContext({ authData })
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
      type: "TenantCertifiedAttributeRevoked",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantCertifiedAttributeRevokedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithCertifiedAttribute,
      attributes: [
        {
          id: attribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    await addOneAttribute(attribute);
    expect(
      tenantService.revokeCertifiedAttributeById(
        {
          tenantId: getMockTenant().id,
          attributeId: attribute.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(tenantNotFound(requesterTenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    const targetTenant = getMockTenant();
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);

    expect(
      tenantService.revokeCertifiedAttributeById(
        {
          tenantId: targetTenant.id,
          attributeId: attribute.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(attributeNotFound(attribute.id));
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
      tenantService.revokeCertifiedAttributeById(
        {
          tenantId: targetTenant.id,
          attributeId: attribute.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(tenantIsNotACertifier(notCertifierTenant.id));
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
      tenantService.revokeCertifiedAttributeById(
        {
          tenantId: targetTenant.id,
          attributeId: attribute.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      attributeDoesNotBelongToCertifier(
        notCompliantOriginAttribute.id,
        requesterTenant.id,
        targetTenant.id
      )
    );
  });
  it("Should throw attributeAlreadyRevoked if the attribute was already assigned revoked", async () => {
    const tenantAlreadyRevoked: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(),
          id: attribute.id,
          revocationTimestamp: new Date(),
        },
      ],
    };
    await addOneAttribute(attribute);
    await addOneTenant(tenantAlreadyRevoked);
    await addOneTenant(requesterTenant);
    expect(
      tenantService.revokeCertifiedAttributeById(
        {
          tenantId: tenantAlreadyRevoked.id,
          attributeId: attribute.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      attributeAlreadyRevoked(
        tenantAlreadyRevoked.id,
        requesterTenant.id,
        attribute.id
      )
    );
  });
});
