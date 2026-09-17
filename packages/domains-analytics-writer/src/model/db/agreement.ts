import {
  AgreementSchema,
  AgreementAttributeSchema,
  AgreementConsumerDocumentSchema,
  AgreementContractSchema,
  AgreementStampSchema,
  AgreementSignedContractSchema,
} from "pagopa-interop-kpi-models";

export const AgreementDbTableConfig = {
  agreement: AgreementSchema,
  agreement_stamp: AgreementStampSchema,
  agreement_attribute: AgreementAttributeSchema,
  agreement_consumer_document: AgreementConsumerDocumentSchema,
  agreement_contract: AgreementContractSchema,
  agreement_signed_contract: AgreementSignedContractSchema,
} as const;

export type AgreementDbTableConfig = typeof AgreementDbTableConfig;

export type AgreementDbTable = keyof AgreementDbTableConfig;

export const AgreementDbTable = Object.fromEntries(
  Object.keys(AgreementDbTableConfig).map((k) => [k, k])
) as { [K in AgreementDbTable]: K };
