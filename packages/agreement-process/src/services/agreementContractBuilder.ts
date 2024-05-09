import { FileManager, Logger } from "pagopa-interop-commons";
import { Agreement, EService, SelfcareId, Tenant } from "pagopa-interop-models";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { pdfGenerator } from "./pdfGenerator.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const contractBuilder = (
  selfcareId: SelfcareId,
  attributeQuery: AttributeQuery,
  storeFile: FileManager["storeBytes"],
  logger: Logger
) => ({
  createContract: async (
    agreement: Agreement,
    eservice: EService,
    consumer: Tenant,
    producer: Tenant,
    seed: UpdateAgreementSeed
  ): Promise<ApiAgreementDocumentSeed> =>
    await pdfGenerator.createDocumentSeed(
      selfcareId,
      agreement,
      eservice,
      consumer,
      producer,
      seed,
      attributeQuery,
      storeFile,
      logger
    ),
});

export type ContractBuilder = ReturnType<typeof contractBuilder>;
