import {
  getMockAgreement,
  getMockAuthData,
  getMockContext,
  getMockDelegation,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  agreementState,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  addOneAgreement,
  addOneDelegation,
  addOneEservice,
  addOneTenant,
  delegationService,
} from "../integrationUtils.js";

describe("delegator hierarchy filters", () => {
  it.each([
    "Hierarchy unit",
    "Hierarchy area",
    "Hierarchy institution",
    "absent",
  ])(
    "matches %s while preserving delegation and agreement constraints",
    async (delegatorName) => {
      const requester = getMockTenant();
      const root = { ...getMockTenant(), name: "Hierarchy institution" };
      const parent = { ...getMockTenant(), name: "Hierarchy area" };
      const eservice = getMockEService();
      await addOneTenant(root);
      await addOneTenant(parent);
      await addOneEservice(eservice);
      const scenarios = [
        ...Object.values(delegationState).map((state) => ({
          state,
          kind: delegationKind.delegatedConsumer,
          delegateId: requester.id,
          activeAgreement: true,
        })),
        {
          state: delegationState.active,
          kind: delegationKind.delegatedProducer,
          delegateId: requester.id,
          activeAgreement: true,
        },
        {
          state: delegationState.active,
          kind: delegationKind.delegatedConsumer,
          delegateId: getMockTenant().id,
          activeAgreement: true,
        },
        {
          state: delegationState.active,
          kind: delegationKind.delegatedConsumer,
          delegateId: requester.id,
          activeAgreement: false,
        },
      ];
      const units = scenarios.map(() => ({
        ...getMockTenant(),
        name: "Hierarchy unit",
        parentTenantId: parent.id,
        rootTenantId: root.id,
      }));
      for (const [index, scenario] of scenarios.entries()) {
        const unit = units[index];
        await addOneTenant(unit);
        await addOneDelegation(
          getMockDelegation({
            ...scenario,
            delegatorId: unit.id,
            eserviceId: eservice.id,
          })
        );
        await addOneAgreement({
          ...getMockAgreement(
            eservice.id,
            unit.id,
            scenario.activeAgreement
              ? agreementState.active
              : agreementState.rejected
          ),
          producerId: eservice.producerId,
        });
      }
      const eligibleIds = scenarios.flatMap((scenario, index) =>
        scenario.state === delegationState.active &&
        scenario.kind === delegationKind.delegatedConsumer &&
        scenario.delegateId === requester.id
          ? [units[index].id]
          : []
      );
      const context = getMockContext({
        authData: getMockAuthData(requester.id),
      });
      const result = await delegationService.getConsumerDelegators(
        {
          delegatorName,
          eserviceIds: [eservice.id],
          offset: 0,
          limit: 50,
        },
        context
      );
      const withAgreements =
        await delegationService.getConsumerDelegatorsWithAgreements(
          {
            delegatorName,
            offset: 0,
            limit: 50,
          },
          context
        );
      expect(result.results.map((t) => t.id).sort()).toEqual(
        delegatorName === "absent" ? [] : eligibleIds.sort()
      );
      expect(result.totalCount).toBe(
        delegatorName === "absent" ? 0 : eligibleIds.length
      );
      const activeIds = eligibleIds.filter(
        (id) => id !== units[units.length - 1].id
      );
      expect(withAgreements.results.map((t) => t.id)).toEqual(
        delegatorName === "absent" ? [] : activeIds
      );
      expect(withAgreements.totalCount).toBe(
        delegatorName === "absent" ? 0 : activeIds.length
      );
      const excludedService = await delegationService.getConsumerDelegators(
        {
          delegatorName,
          eserviceIds: [getMockEService().id],
          offset: 0,
          limit: 50,
        },
        context
      );
      expect(excludedService.results).toEqual([]);
    }
  );
});
