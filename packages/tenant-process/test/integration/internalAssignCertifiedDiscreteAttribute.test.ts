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
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { certifiedAttributeAlreadyAssigned } from "../../src/model/domain/errors.js";
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
    const targetTenant: Tenant = {
      ...getMockTenant(),
      attributes: [],
      remoteIds: [
        { origin: "ISTAT", value: "015146", assignmentTimestamp: new Date() },
      ],
    };

    await addOneAttribute(certifiedAttribute);
    await addOneTenant(targetTenant);

    await tenantService.internalAssignCertifiedDiscreteAttribute(
      {
        tenantOrigin: targetTenant.externalId.origin,
        tenantRemoteId: targetTenant.remoteIds![0].value,
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
          assignmentTimestamp: expect.any(Date),
          discreteValue: mockPopulationValue,
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: expect.any(Date),
    };

    expect(writtenPayload).toEqual({
      attributeId: certifiedAttribute.id,
      tenant: toTenantV2(updatedTenant),
    });
  });

  it("Should throw certifiedAttributeAlreadyAssigned if the discrete attribute was already assigned", async () => {
    const tenantAlreadyAssigned: Tenant = {
      ...getMockTenant(),
      remoteIds: [
        { origin: "ISTAT", value: "015146", assignmentTimestamp: new Date() },
      ],
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
      // CHIAMATA CORRETTA CON OGGETTO
      tenantService.internalAssignCertifiedDiscreteAttribute(
        {
          tenantOrigin: tenantAlreadyAssigned.externalId.origin,
          tenantRemoteId: tenantAlreadyAssigned.remoteIds![0].value,
          attributeOrigin: certifiedAttribute.origin!,
          attributeExternalId: certifiedAttribute.code!,
          value: mockPopulationValue,
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

  // Qui puoi aggiungere i test per tenantNotFound e attributeNotFound seguendo la stessa logica ad oggetto
});
