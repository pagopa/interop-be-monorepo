/* eslint-disable functional/no-let */
import { getMockDelegation } from "pagopa-interop-commons-test";
import {
  DelegationId,
  delegationKind,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { delegationNotFound } from "../src/model/domain/errors.js";
import { addOneDelegation, delegationService } from "./utils.js";

describe("get delegation by id", () => {
  it.each(Object.values(delegationKind))(
    "should get the %s delegation if it exists",
    async (kind) => {
      const delegation = getMockDelegation({ kind });
      await addOneDelegation(delegation);

      const expectedDelegation = await delegationService.getDelegationById(
        delegation.id,
        genericLogger
      );

      expect(delegation).toEqual(expectedDelegation);
    }
  );

  it.each(Object.values(delegationKind))(
    "should fail with delegationNotFound for %s delegations",
    async (kind) => {
      const delegation = getMockDelegation({ kind });
      await addOneDelegation(delegation);

      const notFoundId = generateId<DelegationId>();
      const expectedDelegation = delegationService.getDelegationById(
        notFoundId,
        genericLogger
      );

      await expect(expectedDelegation).rejects.toThrow(
        delegationNotFound(notFoundId)
      );
    }
  );
});
