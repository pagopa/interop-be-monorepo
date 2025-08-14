/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { attributeKind, DelegationId, TenantId } from "pagopa-interop-models";
import {
  getMockAttribute,
  readLastEventByStreamId,
  getMockTenant,
  getMockDelegation,
  getMockContext,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Tenant,
  unsafeBrandId,
  protobufDecoder,
  fromTenantKindV2,
  toTenantV2,
  TenantDeclaredAttributeAssignedV2,
  Attribute,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import {
  tenantNotFound,
  attributeNotFound,
  delegationNotFound,
  operationRestrictedToDelegate,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  postgresDB,
  tenantService,
  addOneDelegation,
} from "../integrationUtils.js";

describe("addDeclaredAttribute", async () => {
  const declaredAttribute: Attribute = {
    ...getMockAttribute(),
    kind: attributeKind.declared,
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const tenant = getMockTenant();

  it("Should add the declared attribute if the tenant doesn't have that", async () => {
    const tenantWithoutDeclaredAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [],
    };

    await addOneAttribute(declaredAttribute);
    await addOneTenant(tenantWithoutDeclaredAttribute);
    const addDeclaredAttrReturn = await tenantService.addDeclaredAttribute(
      {
        tenantAttributeSeed: { id: declaredAttribute.id },
      },
      getMockContext({
        authData: getMockAuthData(tenantWithoutDeclaredAttribute.id),
      })
    );
    const writtenEvent = await readLastEventByStreamId(
      tenantWithoutDeclaredAttribute.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenantWithoutDeclaredAttribute.id,
      version: "1",
      type: "TenantDeclaredAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithoutDeclaredAttribute,
      attributes: [
        {
          id: declaredAttribute.id,
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload).toEqual({
      tenant: toTenantV2(updatedTenant),
      attributeId: declaredAttribute.id,
    });
    expect(addDeclaredAttrReturn).toEqual({
      data: updatedTenant,
      metadata: { version: 1 },
    });
  });
  it("Should re-assign the declared attribute if it was revoked", async () => {
    const tenantWithAttributeRevoked: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: declaredAttribute.id,
          type: tenantAttributeType.DECLARED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };
    await addOneAttribute(declaredAttribute);
    await addOneTenant(tenantWithAttributeRevoked);
    const addDeclaredAttrReturn = await tenantService.addDeclaredAttribute(
      {
        tenantAttributeSeed: { id: declaredAttribute.id },
      },
      getMockContext({
        authData: getMockAuthData(tenantWithAttributeRevoked.id),
      })
    );
    const writtenEvent = await readLastEventByStreamId(
      tenantWithAttributeRevoked.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: tenantWithAttributeRevoked.id,
      version: "1",
      type: "TenantDeclaredAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...tenantWithAttributeRevoked,
      attributes: [
        {
          id: declaredAttribute.id,
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(),
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload).toEqual({
      tenant: toTenantV2(updatedTenant),
      attributeId: declaredAttribute.id,
    });
    expect(addDeclaredAttrReturn).toEqual({
      data: updatedTenant,
      metadata: { version: 1 },
    });
  });
  it("Should add the declared attribute to the delegator if the delegator doesn't have that", async () => {
    const delegateWithoutDeclaredAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [],
    };
    const delegatorWithoutDeclaredAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [],
    };

    await addOneAttribute(declaredAttribute);
    await addOneTenant(delegateWithoutDeclaredAttribute);
    await addOneTenant(delegatorWithoutDeclaredAttribute);

    const delegationId: DelegationId = generateId();

    await addOneDelegation(
      getMockDelegation({
        id: delegationId,
        kind: "DelegatedConsumer",
        state: "Active",
        delegatorId: delegatorWithoutDeclaredAttribute.id,
        delegateId: delegateWithoutDeclaredAttribute.id,
      })
    );

    const addDeclaredAttrReturn = await tenantService.addDeclaredAttribute(
      {
        tenantAttributeSeed: {
          id: declaredAttribute.id,
          delegationId,
        },
      },
      getMockContext({
        authData: getMockAuthData(delegateWithoutDeclaredAttribute.id),
      })
    );
    const writtenEvent = await readLastEventByStreamId(
      delegatorWithoutDeclaredAttribute.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: delegatorWithoutDeclaredAttribute.id,
      version: "1",
      type: "TenantDeclaredAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...delegatorWithoutDeclaredAttribute,
      attributes: [
        {
          id: declaredAttribute.id,
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(),
          delegationId,
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload).toEqual({
      tenant: toTenantV2(updatedTenant),
      attributeId: declaredAttribute.id,
    });
    expect(addDeclaredAttrReturn).toEqual({
      data: updatedTenant,
      metadata: { version: 1 },
    });
  });
  it("Should re-assign the declared attribute to the delegator if it was revoked", async () => {
    const delegateWithoutDeclaredAttribute: Tenant = {
      ...getMockTenant(),
      attributes: [],
    };
    const delegatorWithAttributeRevoked: Tenant = {
      ...getMockTenant(),
      attributes: [
        {
          id: declaredAttribute.id,
          type: tenantAttributeType.DECLARED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };
    await addOneAttribute(declaredAttribute);
    await addOneTenant(delegateWithoutDeclaredAttribute);
    await addOneTenant(delegatorWithAttributeRevoked);

    const delegationId: DelegationId = generateId();
    await addOneDelegation(
      getMockDelegation({
        id: delegationId,
        kind: "DelegatedConsumer",
        state: "Active",
        delegatorId: delegatorWithAttributeRevoked.id,
        delegateId: delegateWithoutDeclaredAttribute.id,
      })
    );

    const addDeclaredAttrReturn = await tenantService.addDeclaredAttribute(
      {
        tenantAttributeSeed: { id: declaredAttribute.id, delegationId },
      },
      getMockContext({
        authData: getMockAuthData(delegateWithoutDeclaredAttribute.id),
      })
    );

    const writtenEvent = await readLastEventByStreamId(
      delegatorWithAttributeRevoked.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: delegatorWithAttributeRevoked.id,
      version: "1",
      type: "TenantDeclaredAttributeAssigned",
      event_version: 2,
    });
    const writtenPayload = protobufDecoder(
      TenantDeclaredAttributeAssignedV2
    ).parse(writtenEvent?.data);

    const updatedTenant: Tenant = {
      ...delegatorWithAttributeRevoked,
      attributes: [
        {
          id: declaredAttribute.id,
          type: "PersistentDeclaredAttribute",
          assignmentTimestamp: new Date(),
          delegationId,
        },
      ],
      kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
      updatedAt: new Date(),
    };
    expect(writtenPayload).toEqual({
      tenant: toTenantV2(updatedTenant),
      attributeId: declaredAttribute.id,
    });
    expect(addDeclaredAttrReturn).toEqual({
      data: updatedTenant,
      metadata: { version: 1 },
    });
  });
  it("Should throw tenantNotFound if the tenant doesn't exist", async () => {
    await addOneAttribute(declaredAttribute);
    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: { id: declaredAttribute.id },
        },
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });
  it("Should throw attributeNotFound if the attribute doesn't exist", async () => {
    await addOneTenant(tenant);

    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: { id: declaredAttribute.id },
        },
        getMockContext({
          authData: getMockAuthData(tenant.id),
        })
      )
    ).rejects.toThrowError(
      attributeNotFound(unsafeBrandId(declaredAttribute.id))
    );
  });
  it("Should throw delegationNotFound if the delegation doesn't exist", async () => {
    await addOneTenant(tenant);

    const delegationId: DelegationId = generateId();
    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: {
            id: declaredAttribute.id,
            delegationId,
          },
        },
        getMockContext({})
      )
    ).rejects.toThrowError(delegationNotFound(delegationId));
  });
  it("Should throw delegationNotFound if the delegation is not active", async () => {
    await addOneTenant(tenant);

    const delegationId: DelegationId = generateId();
    await addOneDelegation(
      getMockDelegation({
        id: delegationId,
        kind: "DelegatedConsumer",
        state: "WaitingForApproval",
        delegatorId: generateId<TenantId>(),
        delegateId: generateId<TenantId>(),
      })
    );
    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: {
            id: declaredAttribute.id,
            delegationId,
          },
        },
        getMockContext({})
      )
    ).rejects.toThrowError(delegationNotFound(delegationId));
  });
  it("Should throw delegationNotFound if the delegation is not of kind DelegatedConsumer", async () => {
    await addOneTenant(tenant);

    const delegationId: DelegationId = generateId();
    await addOneDelegation(
      getMockDelegation({
        id: delegationId,
        kind: "DelegatedProducer",
        state: "Active",
        delegatorId: generateId<TenantId>(),
        delegateId: generateId<TenantId>(),
      })
    );
    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: {
            id: declaredAttribute.id,
            delegationId,
          },
        },
        getMockContext({})
      )
    ).rejects.toThrowError(delegationNotFound(delegationId));
  });
  it("Should throw notAllowedToAddDeclaredAttribute if the caller is not the delegate", async () => {
    await addOneTenant(tenant);

    const delegationId: DelegationId = generateId();
    await addOneDelegation(
      getMockDelegation({
        id: delegationId,
        kind: "DelegatedConsumer",
        state: "Active",
        delegatorId: generateId<TenantId>(),
        delegateId: generateId<TenantId>(),
      })
    );
    expect(
      tenantService.addDeclaredAttribute(
        {
          tenantAttributeSeed: {
            id: declaredAttribute.id,
            delegationId,
          },
        },
        getMockContext({})
      )
    ).rejects.toThrowError(operationRestrictedToDelegate());
  });
});
