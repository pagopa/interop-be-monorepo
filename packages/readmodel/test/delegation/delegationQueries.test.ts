/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";
import {
  Delegation,
  DelegationId,
  delegationKind,
  generateId,
  WithMetadata,
} from "pagopa-interop-models";
import { getMockDelegation } from "pagopa-interop-commons-test/index.js";
import { upsertDelegation } from "../../src/testUtils.js";
import { delegationReadModelService } from "./delegationUtils.js";
import { readModelDB } from "../utils.js";

describe("Delegation queries", () => {
  describe("Get a Delegation", () => {
    it("should get a delegation by id if present", async () => {
      const delegation: WithMetadata<Delegation> = {
        data: getMockDelegation({
          kind: delegationKind.delegatedProducer,
        }),
        metadata: { version: 1 },
      };
      await upsertDelegation(
        readModelDB,
        delegation.data,
        delegation.metadata.version
      );
      const retrievedDelegation =
        await delegationReadModelService.getDelegationById(delegation.data.id);
      expect(retrievedDelegation).toStrictEqual(delegation);
    });

    it("should not get a delegation by id if not present", async () => {
      const retrievedDelegation =
        await delegationReadModelService.getDelegationById(
          generateId<DelegationId>()
        );

      expect(retrievedDelegation).toBeUndefined();
    });
  });
});
