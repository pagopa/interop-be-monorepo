/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { attributeKind, toReadModelAttribute } from "pagopa-interop-models";

import {
  writeInReadmodel,
  getMockAttribute,
  getMockTenant,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  Attribute,
  unsafeBrandId,
  protobufDecoder,
  TenantCertifiedAttributeAssignedV2,
  fromTenantKindV2,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantNotFoundByExternalId,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  attributes,
  postgresDB,
  tenantService,
} from "./utils.js";

describe("internalAssignCertifiedAttributes", async () => {
  const attribute: Attribute = {
    ...getMockAttribute(),
    kind: attributeKind.certified,
  };

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
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await addOneTenant(targetTenant);
    await tenantService.internalAssignCertifiedAttribute(
      {
        tenantOrigin: targetTenant.externalId.origin,
        tenantExternalId: targetTenant.externalId.value,
        attributeOrigin: attribute.origin!,
        attributeExternalId: attribute.code!,
        correlationId: generateId(),
      },
      genericLogger
    );
    const writtenEvent = await readLastEventByStreamId(
      targetTenant.id,
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
          id: unsafeBrandId(attribute.id),
          type: "PersistentCertifiedAttribute",
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
          id: unsafeBrandId(attribute.id),
          type: "PersistentCertifiedAttribute",
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };

    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await addOneTenant(tenantWithCertifiedAttribute);
    await tenantService.internalAssignCertifiedAttribute(
      {
        tenantOrigin: tenantWithCertifiedAttribute.externalId.origin,
        tenantExternalId: tenantWithCertifiedAttribute.externalId.value,
        attributeOrigin: attribute.origin!,
        attributeExternalId: attribute.code!,
        correlationId: generateId(),
      },
      genericLogger
    );
    const writtenEvent = await readLastEventByStreamId(
      tenantWithCertifiedAttribute.id,
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
          id: unsafeBrandId(attribute.id),
          type: "PersistentCertifiedAttribute",
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
          id: attribute.id,
          type: "PersistentCertifiedAttribute",
          assignmentTimestamp: new Date(),
        },
      ],
    };
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    await addOneTenant(tenantAlreadyAssigned);
    expect(
      tenantService.internalAssignCertifiedAttribute(
        {
          tenantOrigin: tenantAlreadyAssigned.externalId.origin,
          tenantExternalId: tenantAlreadyAssigned.externalId.value,
          attributeOrigin: attribute.origin!,
          attributeExternalId: attribute.code!,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      certifiedAttributeAlreadyAssigned(
        unsafeBrandId(attribute.id),
        unsafeBrandId(tenantAlreadyAssigned.id)
      )
    );
  });
  it("Should throw tenantNotFoundByExternalId if the target tenant doesn't exist", async () => {
    await writeInReadmodel(toReadModelAttribute(attribute), attributes);
    const targetTenant = getMockTenant();
    expect(
      tenantService.internalAssignCertifiedAttribute(
        {
          tenantOrigin: targetTenant.externalId.origin,
          tenantExternalId: targetTenant.externalId.value,
          attributeOrigin: attribute.origin!,
          attributeExternalId: attribute.code!,
          correlationId: generateId(),
        },
        genericLogger
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
          attributeOrigin: attribute.origin!,
          attributeExternalId: attribute.code!,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      attributeNotFound(unsafeBrandId(`${attribute.origin}/${attribute.code}`))
    );
  });
});
