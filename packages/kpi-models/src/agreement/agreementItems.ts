import { z } from "zod";
import { AgreementSchema } from "./agreement.js";
import { AgreementStampSchema } from "./agreementStamp.js";
import { AgreementAttributeSchema } from "./agreementAttribute.js";
import { AgreementConsumerDocumentSchema } from "./agreementConsumerDocument.js";
import { AgreementContractSchema } from "./agreementContract.js";
import { AgreementSignedContractSchema } from "./agreementSignedContract.js";

export const AgreementItemsSchema = z.object({
  agreementSQL: AgreementSchema,
  stampsSQL: z.array(AgreementStampSchema),
  attributesSQL: z.array(AgreementAttributeSchema),
  consumerDocumentsSQL: z.array(AgreementConsumerDocumentSchema),
  contractSQL: AgreementContractSchema.optional(),
  signedContractSQL: AgreementSignedContractSchema.optional(),
});

export type AgreementItemsSchema = z.infer<typeof AgreementItemsSchema>;
