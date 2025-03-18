/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";
import {
  Delegation,
  delegationKind,
  generateId,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  getMockDelegation,
  getMockDelegationDocument,
} from "pagopa-interop-commons-test/index.js";
import {
  delegationReadModelService,
  readDelegationContractDocumentSQLByAgreementId,
  readDelegationStampsSQLByDelegationId,
} from "./delegationUtils.js";

describe("Delegation queries", () => {
  describe("upsertDelegation", () => {
    it("should add a complete (*all* fields) delegation", async () => {
      const delegation: WithMetadata<Delegation> = {
        data: {
          ...getMockDelegation({ kind: delegationKind.delegatedProducer }),
          updatedAt: new Date(),
          stamps: {
            submission: {
              who: generateId<UserId>(),
              when: new Date(),
            },
            activation: {
              who: generateId<UserId>(),
              when: new Date(),
            },
            rejection: {
              who: generateId<UserId>(),
              when: new Date(),
            },
            revocation: {
              who: generateId<UserId>(),
              when: new Date(),
            },
          },
          rejectionReason: "a rejection reason",
          activationContract: getMockDelegationDocument(),
          revocationContract: getMockDelegationDocument(),
        },
        metadata: { version: 1 },
      };

      await delegationReadModelService.upsertDelegation(delegation.data, 1);

      const retrievedDelegation =
        await delegationReadModelService.getDelegationById(delegation.data.id);

      const retrievedStamps = await readDelegationStampsSQLByDelegationId(
        delegation.data.id
      );
      const retrievedDelegationContract =
        await readDelegationContractDocumentSQLByAgreementId(
          delegation.data.id
        );

      expect(retrievedDelegation).toStrictEqual(delegation);
      expect(retrievedStamps).toHaveLength(4);
      expect(retrievedDelegationContract).toHaveLength(2);
    });

    it("should add an incomplete (*only* mandatory fields) delegation", async () => {
      const delegation: WithMetadata<Delegation> = {
        data: {
          ...getMockDelegation({ kind: delegationKind.delegatedProducer }),
        },
        metadata: { version: 1 },
      };

      await delegationReadModelService.upsertDelegation(delegation.data, 1);

      const retrievedDelegation =
        await delegationReadModelService.getDelegationById(delegation.data.id);

      const retrievedStamps = await readDelegationStampsSQLByDelegationId(
        delegation.data.id
      );
      const retrievedDelegationContract =
        await readDelegationContractDocumentSQLByAgreementId(
          delegation.data.id
        );

      expect(retrievedDelegation).toStrictEqual(delegation);
      expect(retrievedStamps).toHaveLength(1);
      expect(retrievedDelegationContract).toHaveLength(0);
    });

    it("should update a complete (*all* fields) delegation", async () => {
      const delegation: WithMetadata<Delegation> = {
        data: {
          ...getMockDelegation({ kind: delegationKind.delegatedProducer }),
          updatedAt: new Date(),
          stamps: {
            submission: {
              who: generateId<UserId>(),
              when: new Date(),
            },
            activation: {
              who: generateId<UserId>(),
              when: new Date(),
            },
            rejection: {
              who: generateId<UserId>(),
              when: new Date(),
            },
            revocation: {
              who: generateId<UserId>(),
              when: new Date(),
            },
          },
          rejectionReason: "a rejection reason",
          activationContract: getMockDelegationDocument(),
          revocationContract: getMockDelegationDocument(),
        },
        metadata: { version: 1 },
      };

      const updatedDelegation: WithMetadata<Delegation> = {
        data: {
          ...delegation.data,
          updatedAt: new Date(),
          rejectionReason: "an updated rejection reason",
        },
        metadata: { version: 2 },
      };

      await delegationReadModelService.upsertDelegation(
        delegation.data,
        delegation.metadata.version
      );

      await delegationReadModelService.upsertDelegation(
        updatedDelegation.data,
        updatedDelegation.metadata.version
      );

      const retrievedDelegation =
        await delegationReadModelService.getDelegationById(
          updatedDelegation.data.id
        );

      const retrievedStamps = await readDelegationStampsSQLByDelegationId(
        delegation.data.id
      );
      const retrievedDelegationContract =
        await readDelegationContractDocumentSQLByAgreementId(
          delegation.data.id
        );

      expect(retrievedDelegation).toStrictEqual(updatedDelegation);
      expect(retrievedStamps).toHaveLength(4);
      expect(retrievedDelegationContract).toHaveLength(2);
    });
  });

  describe("getDelegationById", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    it("delegation found", async () => {});

    it("delegation NOT found", async () => {
      const delegation: WithMetadata<Delegation> = {
        data: getCustomMockAgreement(),
        metadata: { version: 1 },
      };

      await delegationReadModelService.upsertDelegation(
        getCustomMockAgreement(),
        1
      );

      const retrievedAgreement =
        await delegationReadModelService.getAgreementById(delegation.data.id);

      expect(retrievedAgreement).toBeUndefined();
    });
  });

  describe("deleteDelegationtById", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    it("delete one delegation", async () => {});
  });
});
