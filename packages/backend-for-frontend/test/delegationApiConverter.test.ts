import { bffApi } from "pagopa-interop-api-clients";
import {
  getMockedApiEservice,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { generateId, tenantUnitType } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  toBffDelegationApiCompactDelegation,
  toBffDelegationApiDelegation,
} from "../src/api/delegationApiConverter.js";
import { getMockDelegationApiDelegation } from "./mockUtils.js";

describe("delegationApiConverter", () => {
  const delegatorParentId = generateId();
  const delegateParentId = generateId();
  const producerParentId = generateId();
  const rootId = generateId();
  const delegator = {
    ...getMockedApiTenant(),
    subUnitType: tenantUnitType.UO,
    parentTenants: [
      {
        id: delegatorParentId,
        name: "Delegator AOO",
        subUnitType: tenantUnitType.AOO,
      },
      { id: rootId, name: "Tenant root" },
    ],
  };
  const delegate = {
    ...getMockedApiTenant(),
    subUnitType: tenantUnitType.UO,
    parentTenants: [
      {
        id: delegateParentId,
        name: "Delegate AOO",
        subUnitType: tenantUnitType.AOO,
      },
      { id: rootId, name: "Tenant root" },
    ],
  };
  const producer = {
    ...getMockedApiTenant(),
    subUnitType: tenantUnitType.UO,
    parentTenants: [
      {
        id: producerParentId,
        name: "Producer AOO",
        subUnitType: tenantUnitType.AOO,
      },
      { id: rootId, name: "Tenant root" },
    ],
  };
  const eservice = { ...getMockedApiEservice(), producerId: producer.id };
  const delegation = {
    ...getMockDelegationApiDelegation(),
    delegatorId: delegator.id,
    delegateId: delegate.id,
    eserviceId: eservice.id,
  };
  const expectedTenants = {
    delegator: {
      id: delegator.id,
      name: delegator.name,
      subUnitType: tenantUnitType.UO,
      parentTenants: [
        {
          id: delegatorParentId,
          name: "Delegator AOO",
          subUnitType: tenantUnitType.AOO,
        },
        { id: rootId, name: "Tenant root" },
      ],
    },
    delegate: {
      id: delegate.id,
      name: delegate.name,
      subUnitType: tenantUnitType.UO,
      parentTenants: [
        {
          id: delegateParentId,
          name: "Delegate AOO",
          subUnitType: tenantUnitType.AOO,
        },
        { id: rootId, name: "Tenant root" },
      ],
    },
  };

  it("should preserve delegator, delegate and producer hierarchy in delegation details", () => {
    const result = toBffDelegationApiDelegation(
      delegation,
      delegator,
      delegate,
      eservice,
      false,
      producer
    );
    expect(bffApi.Delegation.parse(result)).toMatchObject({
      ...expectedTenants,
      eservice: {
        producerId: producer.id,
        producerName: producer.name,
        producerSubUnitType: tenantUnitType.UO,
        producerParentTenants: [
          {
            id: producerParentId,
            name: "Producer AOO",
            subUnitType: tenantUnitType.AOO,
          },
          { id: rootId, name: "Tenant root" },
        ],
      },
    });
  });

  it("should preserve delegator and delegate hierarchy in delegation lists", () => {
    const result = toBffDelegationApiCompactDelegation(
      delegation,
      delegator,
      delegate,
      eservice,
      true
    );
    expect(bffApi.CompactDelegation.parse(result)).toMatchObject({
      ...expectedTenants,
      hasUnreadNotifications: true,
    });
  });
});
