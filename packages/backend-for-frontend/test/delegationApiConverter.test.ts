import { bffApi } from "pagopa-interop-api-clients";
import {
  getMockedApiEservice,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";

import {
  toBffDelegationApiCompactDelegation,
  toBffDelegationApiDelegation,
} from "../src/api/delegationApiConverter.js";
import {
  getMockBffApiCompactOrganizationWithHierarchy,
  getMockDelegationApiDelegation,
} from "./mockUtils.js";

describe("delegationApiConverter", () => {
  const delegator = {
    ...getMockedApiTenant(),
    ...getMockBffApiCompactOrganizationWithHierarchy(),
  };
  const delegate = {
    ...getMockedApiTenant(),
    ...getMockBffApiCompactOrganizationWithHierarchy(),
  };
  const producer = {
    ...getMockedApiTenant(),
    ...getMockBffApiCompactOrganizationWithHierarchy(),
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
      subUnitType: delegator.subUnitType,
      parentTenants: delegator.parentTenants,
    },
    delegate: {
      id: delegate.id,
      name: delegate.name,
      subUnitType: delegate.subUnitType,
      parentTenants: delegate.parentTenants,
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
        producerSubUnitType: producer.subUnitType,
        producerParentTenants: producer.parentTenants,
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
