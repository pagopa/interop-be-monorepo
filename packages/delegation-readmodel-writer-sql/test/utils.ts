import {
  getMockDelegation,
  getMockDelegationDocument,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { delegationReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { eq } from "drizzle-orm";
import {
  WithMetadata,
  Delegation,
  delegationKind,
  generateId,
  UserId,
  DelegationId,
} from "pagopa-interop-models";
import {
  DelegationSQL,
  DelegationStampSQL,
  DelegationContractDocumentSQL,
  delegationStampInReadmodelDelegation,
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
} from "pagopa-interop-readmodel-models";
import { delegationWriterServiceBuilder } from "../src/delegationWriterService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const delegationReadModelService =
  delegationReadModelServiceBuilder(readModelDB);
export const delegationWriterService =
  delegationWriterServiceBuilder(readModelDB);

export const getCustomMockDelegation = ({
  isDelegationComplete,
}: {
  isDelegationComplete: boolean;
}): WithMetadata<Delegation> => ({
  data: getMockDelegation({
    kind: delegationKind.delegatedProducer,
    ...(isDelegationComplete
      ? {
          updatedAt: new Date(),
          rejectionReason: "Delegation mock rejection reason",
          activationContract: getMockDelegationDocument(),
          revocationContract: getMockDelegationDocument(),
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
        }
      : {}),
  }),
  metadata: { version: 1 },
});

export const retrieveDelegationSQLObjects = async (
  delegation: WithMetadata<Delegation>
): Promise<{
  delegationSQL: DelegationSQL | undefined;
  stampsSQL: DelegationStampSQL[] | undefined;
  contractDocumentsSQL: DelegationContractDocumentSQL[] | undefined;
}> => {
  const delegationSQL = await retrieveDelegationSQL(delegation.data.id);
  const stampsSQL = await retrieveDelegationStampsSQLByDelegationId(
    delegation.data.id
  );
  const contractDocumentsSQL =
    await retrieveDelegationContractDocumentSQLByDelegationId(
      delegation.data.id
    );

  return {
    delegationSQL,
    stampsSQL,
    contractDocumentsSQL,
  };
};

const retrieveDelegationStampsSQLByDelegationId = async (
  delegationId: DelegationId
): Promise<DelegationStampSQL[]> =>
  await readModelDB
    .select()
    .from(delegationStampInReadmodelDelegation)
    .where(eq(delegationStampInReadmodelDelegation.delegationId, delegationId));

const retrieveDelegationContractDocumentSQLByDelegationId = async (
  delegationId: DelegationId
): Promise<DelegationContractDocumentSQL[]> =>
  await readModelDB
    .select()
    .from(delegationContractDocumentInReadmodelDelegation)
    .where(
      eq(
        delegationContractDocumentInReadmodelDelegation.delegationId,
        delegationId
      )
    );
const retrieveDelegationSQL = async (
  delegationId: DelegationId
): Promise<DelegationSQL> => {
  const delegations = await readModelDB
    .select()
    .from(delegationInReadmodelDelegation)
    .where(eq(delegationInReadmodelDelegation.id, delegationId));
  return delegations[0];
};
