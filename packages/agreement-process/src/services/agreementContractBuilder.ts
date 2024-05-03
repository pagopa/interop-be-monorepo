import { FileManager } from "pagopa-interop-commons";
import { Agreement, EService, Tenant } from "pagopa-interop-models";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { pdfGenerator } from "./pdfGenerator.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const contractBuilder = (
  attributeQuery: AttributeQuery,
  storeFile: FileManager["storeBytes"]
) => ({
  createContract: async (
    agreement: Agreement,
    eservice: EService,
    consumer: Tenant,
    producer: Tenant,
    seed: UpdateAgreementSeed
  ): Promise<ApiAgreementDocumentSeed> =>
    await pdfGenerator.createDocumentSeed(
      agreement,
      eservice,
      consumer,
      producer,
      seed,
      attributeQuery,
      storeFile
    ),
});

export type ContractBuilder = ReturnType<typeof contractBuilder>;
