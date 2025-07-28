/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";
import { Delegation, WithMetadata } from "pagopa-interop-models";
import {
  getCustomMockDelegation,
  delegationReadModelService,
  retrieveDelegationSQLObjects,
  delegationWriterService,
} from "./utils.js";

describe("Delegation queries", () => {
  describe("Upsert Delegation", () => {
    it("should add a complete (*all* fields) delegation", async () => {
      const delegation = getCustomMockDelegation({
        isDelegationComplete: true,
      });

      await delegationWriterService.upsertDelegation(delegation.data, 1);

      const retrievedDelegation =
        await delegationReadModelService.getDelegationById(delegation.data.id);

      const { delegationSQL, stampsSQL, contractDocumentsSQL } =
        await retrieveDelegationSQLObjects(delegation);

      expect(retrievedDelegation).toStrictEqual(delegation);
      expect(delegationSQL).toBeDefined();
      expect(stampsSQL).toHaveLength(
        Object.keys(delegation.data.stamps).length
      );
      expect(contractDocumentsSQL).toHaveLength(
        [delegation.data.activationContract, delegation.data.revocationContract]
          .length
      );
    });

    it("should add an incomplete (*only* mandatory fields) delegation", async () => {
      const delegation = getCustomMockDelegation({
        isDelegationComplete: false,
      });

      await delegationWriterService.upsertDelegation(delegation.data, 1);

      const retrievedDelegation =
        await delegationReadModelService.getDelegationById(delegation.data.id);

      const { delegationSQL, stampsSQL, contractDocumentsSQL } =
        await retrieveDelegationSQLObjects(delegation);

      expect(retrievedDelegation).toStrictEqual(delegation);
      expect(delegationSQL).toBeDefined();
      expect(stampsSQL).toHaveLength(
        Object.keys(delegation.data.stamps).length
      );
      expect(contractDocumentsSQL).toHaveLength(0);
    });

    it("should update a complete (*all* fields) delegation", async () => {
      const delegation = getCustomMockDelegation({
        isDelegationComplete: true,
      });

      const updatedDelegation: WithMetadata<Delegation> = {
        data: {
          ...delegation.data,
          updatedAt: new Date(),
          rejectionReason: "an updated rejection reason",
        },
        metadata: { version: 2 },
      };

      await delegationWriterService.upsertDelegation(
        delegation.data,
        delegation.metadata.version
      );

      await delegationWriterService.upsertDelegation(
        updatedDelegation.data,
        updatedDelegation.metadata.version
      );

      const retrievedDelegation =
        await delegationReadModelService.getDelegationById(
          updatedDelegation.data.id
        );

      const { delegationSQL, stampsSQL, contractDocumentsSQL } =
        await retrieveDelegationSQLObjects(delegation);

      expect(retrievedDelegation).toStrictEqual(updatedDelegation);
      expect(delegationSQL).toBeDefined();
      expect(stampsSQL).toHaveLength(
        Object.keys(delegation.data.stamps).length
      );
      expect(contractDocumentsSQL).toHaveLength(
        [delegation.data.activationContract, delegation.data.revocationContract]
          .length
      );
    });
  });

  describe("Delete a Delegation", () => {
    it("should delete a delegation", async () => {
      const delegation = getCustomMockDelegation({
        isDelegationComplete: false,
      });

      await delegationWriterService.upsertDelegation(
        delegation.data,
        delegation.metadata.version
      );

      const {
        delegationSQL: delegationInsertedSQL,
        stampsSQL: stampsInsertedSQL,
        contractDocumentsSQL: contractDocumentsInsertedSQL,
      } = await retrieveDelegationSQLObjects(delegation);

      expect(delegationInsertedSQL).toBeDefined();
      expect(stampsInsertedSQL).toHaveLength(1);
      expect(contractDocumentsInsertedSQL).toHaveLength(0);

      await delegationWriterService.deleteDelegationById(
        delegation.data.id,
        delegation.metadata.version
      );

      const retrievedDeletedDelegation =
        await delegationReadModelService.getDelegationById(delegation.data.id);

      const { delegationSQL, stampsSQL, contractDocumentsSQL } =
        await retrieveDelegationSQLObjects(delegation);

      expect(retrievedDeletedDelegation).toBeUndefined();
      expect(delegationSQL).toBeUndefined();
      expect(stampsSQL).toHaveLength(0);
      expect(contractDocumentsSQL).toHaveLength(0);
    });
  });
});
