/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockAuthData,
  getMockContext,
  getMockDelegation,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  generateId,
  delegationKind,
  delegationState,
  TenantId,
  Tenant,
} from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";

import {
  addOneDelegation,
  addOneEservice,
  addOneTenant,
  delegationService,
} from "../integrationUtils.js";

describe("getConsumerDelegators", () => {
  const rootTenant = { ...getMockTenant(), name: "Regione" };
  const parentTenant: Tenant = {
    ...getMockTenant(),
    name: "Direzione",
    subUnitType: "AOO",
    parentTenantId: rootTenant.id,
    rootTenantId: rootTenant.id,
  };
  const hierarchy = {
    subUnitType: "UO" as const,
    parentTenants: [
      {
        id: parentTenant.id,
        name: parentTenant.name,
        subUnitType: parentTenant.subUnitType,
      },
      { id: rootTenant.id, name: rootTenant.name },
    ],
  };
  const delegator1 = { ...getMockTenant(), name: "Comune di Burione" };
  const delegator2: Tenant = {
    ...getMockTenant(),
    name: "Comune di Milano",
    subUnitType: "UO",
    parentTenantId: parentTenant.id,
    rootTenantId: rootTenant.id,
  };
  const delegator3: Tenant = {
    ...getMockTenant(),
    name: "DeleganteTre",
    subUnitType: "UO",
    parentTenantId: parentTenant.id,
    rootTenantId: rootTenant.id,
  };
  const delegator4 = { ...getMockTenant(), name: "PagoPA" };
  const delegator5 = { ...getMockTenant(), name: "DeleganteCinque" };
  const requesterId = generateId<TenantId>();
  const eservice1 = getMockEService();
  const eservice2 = getMockEService();
  const eservice3 = getMockEService();

  const mockDelegation1 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegator1.id,
    eserviceId: eservice1.id,
  });

  const mockDelegation1Bis = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegator1.id,
    eserviceId: eservice2.id,
  });

  // Delegator1 has 2 active delegations with 2 published eservices

  const mockDelegation2 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegator2.id,
    eserviceId: eservice1.id,
  });

  // Delegator2 has 1 active delegation with 1 published agreement

  const mockDelegation3 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.rejected,
    delegateId: requesterId,
    delegatorId: delegator3.id,
    eserviceId: eservice1.id,
  });

  // Delegator3 has 1 rejected delegation

  const mockDelegation4 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: requesterId,
    delegatorId: delegator4.id,
    eserviceId: eservice3.id,
  });

  // Delegator4 has 1 active delegation with 1 published eservice

  const mockDelegation5 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: generateId<TenantId>(),
    delegatorId: delegator5.id,
    eserviceId: eservice3.id,
  });

  // Delegator5 has 1 active delegation with 1 published eservice but a different delegateId

  beforeEach(async () => {
    await addOneTenant(rootTenant);
    await addOneTenant(parentTenant);
    await addOneEservice(eservice1);
    await addOneEservice(eservice2);
    await addOneEservice(eservice3);
    await addOneDelegation(mockDelegation1);
    await addOneDelegation(mockDelegation1Bis);
    await addOneDelegation(mockDelegation2);
    await addOneDelegation(mockDelegation3);
    await addOneDelegation(mockDelegation4);
    await addOneDelegation(mockDelegation5);
    await addOneTenant(delegator1);
    await addOneTenant(delegator2);
    await addOneTenant(delegator3);
    await addOneTenant(delegator4);
    await addOneTenant(delegator5);
  });

  it("should apply offset and limit", async () => {
    expect(
      await delegationService.getConsumerDelegators(
        {
          eserviceIds: [],
          offset: 1,
          limit: 1,
        },
        getMockContext({ authData: getMockAuthData(requesterId) })
      )
    ).toEqual({
      results: [
        {
          id: delegator2.id,
          name: delegator2.name,
          ...hierarchy,
        },
      ],
      totalCount: 3,
    });
  });
  it("should filter delegators by the 'delegatorName' parameter", async () => {
    expect(
      await delegationService.getConsumerDelegators(
        {
          eserviceIds: [],
          offset: 0,
          limit: 50,
          delegatorName: "Comune",
        },
        getMockContext({ authData: getMockAuthData(requesterId) })
      )
    ).toEqual({
      results: [
        {
          id: delegator1.id,
          name: delegator1.name,
        },
        {
          id: delegator2.id,
          name: delegator2.name,
          ...hierarchy,
        },
      ],
      totalCount: 2,
    });

    expect(
      await delegationService.getConsumerDelegators(
        {
          eserviceIds: [],
          offset: 0,
          limit: 50,
          delegatorName: "PagoPA",
        },
        getMockContext({ authData: getMockAuthData(requesterId) })
      )
    ).toEqual({
      results: [
        {
          id: delegator4.id,
          name: delegator4.name,
        },
      ],
      totalCount: 1,
    });
  });
  it("should filter delegators by the 'eserviceIds' parameter", async () => {
    expect(
      await delegationService.getConsumerDelegators(
        {
          eserviceIds: [eservice1.id, eservice2.id],
          offset: 0,
          limit: 50,
        },
        getMockContext({ authData: getMockAuthData(requesterId) })
      )
    ).toEqual({
      results: [
        {
          id: delegator1.id,
          name: delegator1.name,
        },
        {
          id: delegator2.id,
          name: delegator2.name,
          ...hierarchy,
        },
      ],
      totalCount: 2,
    });
  });
  it.each(["Direzione", "Comune di Milano - Direzione - Regione"])(
    "should filter eligible delegators by hierarchical name %s",
    async (delegatorName) => {
      expect(
        await delegationService.getConsumerDelegators(
          { eserviceIds: [], offset: 0, limit: 50, delegatorName },
          getMockContext({ authData: getMockAuthData(requesterId) })
        )
      ).toEqual({
        results: [{ id: delegator2.id, name: delegator2.name, ...hierarchy }],
        totalCount: 1,
      });
    }
  );
  it("should return an empty array if requester is not a consumer delegate", async () => {
    expect(
      await delegationService.getConsumerDelegators(
        {
          eserviceIds: [],
          offset: 0,
          limit: 50,
        },
        getMockContext({})
      )
    ).toEqual({
      results: [],
      totalCount: 0,
    });
  });
});
