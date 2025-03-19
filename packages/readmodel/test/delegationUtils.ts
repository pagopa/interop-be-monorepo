import { eq } from "drizzle-orm";
import {
  Delegation,
  DelegationId,
  delegationKind,
  generateId,
  stringToDate,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DelegationContractDocumentSQL,
  DelegationSQL,
  DelegationStampSQL,
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
} from "pagopa-interop-readmodel-models";
import {
  getMockDelegation,
  getMockDelegationDocument,
} from "pagopa-interop-commons-test/index.js";
import { delegationReadModelServiceBuilder } from "../src/delegationReadModelService.js";
import { readModelDB } from "./utils.js";

export const delegationReadModelService =
  delegationReadModelServiceBuilder(readModelDB);

export const getCustomMockDelegation = (
  isCompleteDelegation: boolean = true
): WithMetadata<Delegation> =>
  isCompleteDelegation
    ? {
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
      }
    : {
        data: {
          ...getMockDelegation({ kind: delegationKind.delegatedProducer }),
        },
        metadata: { version: 1 },
      };

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

export function stringToISOString(input: string): string;
export function stringToISOString(input: string | null): string | null;
export function stringToISOString(input: string | null): string | null {
  return input ? stringToDate(input).toISOString() : null;
}
