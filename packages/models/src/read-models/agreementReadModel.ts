/*
  This model is required for retro-compatibility with the read model in production:
  the Scala services read/write ISO strings for all date fields.

  After all services will be migrated to TS, we should remove this model
  and the corresponding adapters, as tracked in https://pagopa.atlassian.net/browse/IMN-367
*/

import { z } from "zod";
import {
  Agreement,
  AgreementDocument,
  AgreementStamp,
  AgreementStamps,
} from "../agreement/agreement.js";

export const AgreementDocumentReadModel = AgreementDocument.extend({
  createdAt: z.string().datetime(),
});
export type AgreementDocumentReadModel = z.infer<
  typeof AgreementDocumentReadModel
>;

export const AgreementStampReadModel = AgreementStamp.extend({
  when: z.string().datetime(),
});
export type AgreementStampReadModel = z.infer<typeof AgreementStampReadModel>;

export const AgreementStampsReadModel = AgreementStamps.extend({
  submission: AgreementStampReadModel.optional(),
  activation: AgreementStampReadModel.optional(),
  rejection: AgreementStampReadModel.optional(),
  suspensionByProducer: AgreementStampReadModel.optional(),
  suspensionByConsumer: AgreementStampReadModel.optional(),
  upgrade: AgreementStampReadModel.optional(),
  archiving: AgreementStampReadModel.optional(),
});
export type AgreementStampsReadModel = z.infer<typeof AgreementStampsReadModel>;

export const AgreementReadModel = Agreement.extend({
  consumerDocuments: z.array(AgreementDocumentReadModel),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  contract: AgreementDocumentReadModel.optional(),
  stamps: AgreementStampsReadModel,
  suspendedAt: z.string().datetime().optional(),
});
export type AgreementReadModel = z.infer<typeof AgreementReadModel>;
