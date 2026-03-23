import {
  DelegationSchema,
  DelegationStampSchema,
  DelegationContractDocumentSchema,
  DelegationSignedContractDocumentSchema,
} from "pagopa-interop-kpi-models";

export const DelegationDbTableConfig = {
  delegation: DelegationSchema,
  delegation_stamp: DelegationStampSchema,
  delegation_contract_document: DelegationContractDocumentSchema,
  delegation_signed_contract_document: DelegationSignedContractDocumentSchema,
} as const;
export type DelegationDbTableConfig = typeof DelegationDbTableConfig;

export type DelegationDbTable = keyof typeof DelegationDbTableConfig;

export const DelegationDbTable = Object.fromEntries(
  Object.keys(DelegationDbTableConfig).map((k) => [k, k])
) as { [K in DelegationDbTable]: K };
