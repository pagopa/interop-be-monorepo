import {
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
} from "pagopa-interop-readmodel-models";
import { DelegationSchema } from "../delegation/delegation.js";
import { DelegationStampSchema } from "../delegation/delegationStamp.js";
import { DelegationContractDocumentSchema } from "../delegation/delegationContractDocument.js";

export const DelegationDbTableConfig = {
  delegation: DelegationSchema,
  delegation_stamp: DelegationStampSchema,
  delegation_contract_document: DelegationContractDocumentSchema,
} as const;
export type DelegationDbTableConfig = typeof DelegationDbTableConfig;

export const DelegationDbTableReadModel = {
  delegation: delegationInReadmodelDelegation,
  delegation_stamp: delegationStampInReadmodelDelegation,
  delegation_contract_document: delegationContractDocumentInReadmodelDelegation,
} as const;
export type DelegationDbTableReadModel = typeof DelegationDbTableReadModel;

export type DelegationDbTable = keyof typeof DelegationDbTableConfig;

export const DelegationDbTable = Object.fromEntries(
  Object.keys(DelegationDbTableConfig).map((k) => [k, k])
) as { [K in DelegationDbTable]: K };
