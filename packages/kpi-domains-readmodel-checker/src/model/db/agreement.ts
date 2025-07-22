import {
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
} from "pagopa-interop-readmodel-models";

import { AgreementSchema } from "../agreement/agreement.js";
import { AgreementAttributeSchema } from "../agreement/agreementAttribute.js";
import { AgreementConsumerDocumentSchema } from "../agreement/agreementConsumerDocument.js";
import { AgreementContractSchema } from "../agreement/agreementContract.js";
import { AgreementStampSchema } from "../agreement/agreementStamp.js";

export const AgreementDbTableConfig = {
  agreement: AgreementSchema,
  agreement_stamp: AgreementStampSchema,
  agreement_attribute: AgreementAttributeSchema,
  agreement_consumer_document: AgreementConsumerDocumentSchema,
  agreement_contract: AgreementContractSchema,
} as const;

export type AgreementDbTableConfig = typeof AgreementDbTableConfig;

export const AgreementDbTableReadModel = {
  agreement: agreementInReadmodelAgreement,
  agreement_stamp: agreementStampInReadmodelAgreement,
  agreement_attribute: agreementAttributeInReadmodelAgreement,
  agreement_consumer_document: agreementConsumerDocumentInReadmodelAgreement,
  agreement_contract: agreementContractInReadmodelAgreement,
} as const;

export type AgreementDbTableReadModel = typeof AgreementDbTableReadModel;

export type AgreementDbTable = keyof AgreementDbTableConfig;

export const AgreementDbTable = Object.fromEntries(
  Object.keys(AgreementDbTableConfig).map((k) => [k, k])
) as { [K in AgreementDbTable]: K };
