/* eslint-disable functional/no-let */
import { getMockContext, getMockDelegation } from "pagopa-interop-commons-test";
import {
  DelegationId,
  delegationKind,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { delegationNotFound } from "../src/model/domain/errors.js";
import { addOneDelegation, delegationService } from "./utils.js";

describe("get delegation by id", () => {
  it.each(Object.values(delegationKind))(
    "should get the %s delegation if it exists",
    async (kind) => {
      const delegation = getMockDelegation({ kind });
      await addOneDelegation(delegation);

      const response = await delegationService.getDelegationById(
        delegation.id,
        getMockContext({})
      );

      expect(response).toEqual({
        data: delegation,
        metadata: {
          version: 0,
        },
      });
    }
  );

  it.each(Object.values(delegationKind))(
    "should fail with delegationNotFound for %s delegations",
    async (kind) => {
      const delegation = getMockDelegation({ kind });
      await addOneDelegation(delegation);

      const notFoundId = generateId<DelegationId>();
      const response = delegationService.getDelegationById(
        notFoundId,
        getMockContext({})
      );

      await expect(response).rejects.toThrow(delegationNotFound(notFoundId));
    }
  );
});
