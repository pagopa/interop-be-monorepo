/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { attributeKind, toReadModelAttribute } from "pagopa-interop-models";
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
import { genericLogger } from "pagopa-interop-commons";
import {
  writeInReadmodel,
  getMockAttribute,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import {
  tenantNotFound,
  attributeNotFound,
  tenantIsNotACertifier,
  attributeDoesNotBelongToCertifier,
  attributeAlreadyRevoked,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  getMockTenant,
  getMockCertifiedTenantAttribute,
  tenantService,
  attributes,
  postgresDB,
} from "./utils.js";

describe("revokeCertifiedAttributeById", async () => {
  const targetTenant: Tenant = getMockTenant();
  const requesterTenant: Tenant = {
    ...getMockTenant(),
    features: [
      {
        type: "PersistentCertifier",
        certifierId: generateId(),
      },
    ],
  };
  const attribute: Attribute = {
    ...getMockAttribute(),
    kind: attributeKind.certified,
    origin: requesterTenant.features[0].certifierId,
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
      ...targetTenant,
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(),
          id: attribute.id,
          assignmentTimestamp: new Date(),
        },
      ],
    };

    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await addOneTenant(tenantWithCertifiedAttribute);
    await addOneTenant(requesterTenant);
    await tenantService.revokeCertifiedAttributeById(
      {
        tenantId: tenantWithCertifiedAttribute.id,
        attributeId: attribute.id,
        organizationId: requesterTenant.id,
        correlationId: generateId(),
      },
      genericLogger
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
          type: "PersistentCertifiedAttribute",
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
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    expect(
      tenantService.revokeCertifiedAttributeById(
        {
          tenantId: targetTenant.id,
          attributeId: attribute.id,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(requesterTenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);

    expect(
      tenantService.revokeCertifiedAttributeById(
        {
          tenantId: targetTenant.id,
          attributeId: attribute.id,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(attributeNotFound(attribute.id));
  });
  it("Should throw tenantIsNotACertifier if the requester is not a certifier", async () => {
    const notCertifierTenant: Tenant = {
      ...getMockTenant(),
    };

    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await addOneTenant(targetTenant);
    await addOneTenant(notCertifierTenant);

    expect(
      tenantService.revokeCertifiedAttributeById(
        {
          tenantId: targetTenant.id,
          attributeId: attribute.id,
          organizationId: notCertifierTenant.id,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantIsNotACertifier(notCertifierTenant.id));
  });
  it("Should throw attributeDoesNotBelongToCertifier if attribute origin doesn't match the certifierId of the requester", async () => {
    const notCompliantOriginAttribute: Attribute = {
      ...attribute,
      origin: generateId(),
    };
    await writeInReadmodel(
      toReadModelAttribute(notCompliantOriginAttribute),
      attributes
    );
    await addOneTenant(targetTenant);
    await addOneTenant(requesterTenant);

    expect(
      tenantService.revokeCertifiedAttributeById(
        {
          tenantId: targetTenant.id,
          attributeId: attribute.id,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
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
      ...targetTenant,
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(),
          id: attribute.id,
          revocationTimestamp: new Date(),
        },
      ],
    };
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await addOneTenant(tenantAlreadyRevoked);
    await addOneTenant(requesterTenant);
    expect(
      tenantService.revokeCertifiedAttributeById(
        {
          tenantId: tenantAlreadyRevoked.id,
          attributeId: attribute.id,
          organizationId: requesterTenant.id,
          correlationId: generateId(),
        },
        genericLogger
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
