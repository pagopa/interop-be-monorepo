import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { agreementInReadmodelAgreement } from "pagopa-interop-readmodel-models";
import { AgreementAttributeSchema } from "./agreementAttribute.js";
import { AgreementConsumerDocumentSchema } from "./agreementConsumerDocument.js";
import { AgreementContractSchema } from "./agreementContract.js";
import { AgreementStampSchema } from "./agreementStamp.js";
import { AgreementSignedContractSchema } from "./agreementSignedContract.js";

export const AgreementSchema = createSelectSchema(
  agreementInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementSchema = z.infer<typeof AgreementSchema>;

export const AgreementItemsSchema = z.object({
  agreementSQL: AgreementSchema,
  stampsSQL: z.array(AgreementStampSchema),
  attributesSQL: z.array(AgreementAttributeSchema),
  consumerDocumentsSQL: z.array(AgreementConsumerDocumentSchema),
  contractSQL: AgreementContractSchema.optional(),
  signedContractSQL: AgreementSignedContractSchema.optional(),
});

export type AgreementItemsSchema = z.infer<typeof AgreementItemsSchema>;
