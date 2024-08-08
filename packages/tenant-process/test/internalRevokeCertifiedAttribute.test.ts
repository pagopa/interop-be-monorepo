/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  writeInReadmodel,
  getMockAttribute,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  unsafeBrandId,
  protobufDecoder,
  fromTenantKindV2,
  toTenantV2,
  TenantCertifiedAttributeRevokedV2,
  toReadModelAttribute,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  tenantNotFound,
  attributeNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  getMockTenant,
  getMockCertifiedTenantAttribute,
  tenantService,
  attributes,
  postgresDB,
} from "./utils.js";

describe("testInternalRevokeCertifiedAttribute", async () => {
  const requesterTenant: Tenant = {
    ...getMockTenant(),
    features: [
      {
        type: "PersistentCertifier",
        certifierId: generateId(),
      },
    ],
    externalId: {
      origin: generateId(),
      value: "1234567",
    },
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("Should revoke the certified attribute if it exist", async () => {
    const mockAttribute = getMockAttribute();
    const tenantWithCertifiedAttribute: Tenant = {
      ...requesterTenant,
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(),
          id: mockAttribute.id,
          assignmentTimestamp: new Date(),
        },
      ],
    };

    await writeInReadmodel(toReadModelAttribute(mockAttribute), attributes);
    await addOneTenant(tenantWithCertifiedAttribute);
    await tenantService.internalRevokeCertifiedAttribute(
      {
        tenantOrigin: tenantWithCertifiedAttribute.externalId.origin,
        tenantExternalId: tenantWithCertifiedAttribute.externalId.value,
        attributeOrigin: mockAttribute.origin!,
        attributeExternalId: mockAttribute.code!,
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
          id: unsafeBrandId(mockAttribute.id),
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
    const mockAttribute = getMockAttribute();
    await writeInReadmodel(toReadModelAttribute(mockAttribute), attributes);
    expect(
      tenantService.internalRevokeCertifiedAttribute(
        {
          tenantOrigin: requesterTenant.externalId.origin,
          tenantExternalId: requesterTenant.externalId.value,
          attributeOrigin: mockAttribute.origin!,
          attributeExternalId: mockAttribute.code!,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      tenantNotFound(
        unsafeBrandId(
          `${requesterTenant.externalId.origin}/${requesterTenant.externalId.value}`
        )
      )
    );
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    const mockAttribute = getMockAttribute();
    await addOneTenant(requesterTenant);

    expect(
      tenantService.internalRevokeCertifiedAttribute(
        {
          tenantOrigin: requesterTenant.externalId.origin,
          tenantExternalId: requesterTenant.externalId.value,
          attributeOrigin: mockAttribute.origin!,
          attributeExternalId: mockAttribute.code!,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      attributeNotFound(
        unsafeBrandId(`${mockAttribute.origin}/${mockAttribute.code}`)
      )
    );
  });
});
