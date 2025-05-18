import {
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
} from "pagopa-interop-readmodel-models";
import { extractProp } from "../../db/dbModelMetadataExtractor.js";
import { AgreementSchema } from "../agreement/agreement.js";
import { AgreementAttributeSchema } from "../agreement/agreementAttribute.js";
import { AgreementConsumerDocumentSchema } from "../agreement/agreementConsumerDocument.js";
import { AgreementContractSchema } from "../agreement/agreementContract.js";
import { AgreementStampSchema } from "../agreement/agreementStamp.js";

const AgreementTableMeta = {
  agreement: {
    schema: AgreementSchema,
    readModel: agreementInReadmodelAgreement,
  },
  agreement_stamp: {
    schema: AgreementStampSchema,
    readModel: agreementStampInReadmodelAgreement,
  },
  agreement_attribute: {
    schema: AgreementAttributeSchema,
    readModel: agreementAttributeInReadmodelAgreement,
  },
  agreement_consumer_document: {
    schema: AgreementConsumerDocumentSchema,
    readModel: agreementConsumerDocumentInReadmodelAgreement,
  },
  agreement_contract: {
    schema: AgreementContractSchema,
    readModel: agreementContractInReadmodelAgreement,
  },
} as const;

export const AgreementDbTableConfig = extractProp(AgreementTableMeta, "schema");
export type AgreementDbTableConfig = typeof AgreementDbTableConfig;

export const AgreementDbTableReadModel = extractProp(
  AgreementTableMeta,
  "readModel"
);
export type AgreementDbTableReadModel = typeof AgreementDbTableReadModel;

export type AgreementDbTable = keyof typeof AgreementDbTableConfig;
export const AgreementDbTable = Object.fromEntries(
  Object.keys(AgreementDbTableConfig).map((k) => [k, k])
) as { [K in AgreementDbTable]: K };
