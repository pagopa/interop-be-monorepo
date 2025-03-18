import { eq } from "drizzle-orm";
import { DelegationId } from "pagopa-interop-models";
import {
  DelegationContractDocumentSQL,
  DelegationStampSQL,
  delegationContractDocumentInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
} from "pagopa-interop-readmodel-models";
import { delegationReadModelServiceBuilder } from "../src/delegationReadModelService.js";
import { readModelDB } from "./utils.js";

export const delegationReadModelService =
  delegationReadModelServiceBuilder(readModelDB);

export const readDelegationStampsSQLByDelegationId = async (
  delegationId: DelegationId
): Promise<DelegationStampSQL[]> =>
  await readModelDB
    .select()
    .from(delegationStampInReadmodelDelegation)
    .where(eq(delegationStampInReadmodelDelegation.delegationId, delegationId));

export const readDelegationContractDocumentSQLByAgreementId = async (
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
