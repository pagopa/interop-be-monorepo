import { CreateEvent, logger } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocument,
  AgreementEvent,
  EService,
  Tenant,
} from "pagopa-interop-models";
import { toCreateEventAgreementContractAdded } from "../model/domain/toEvent.js";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { pdfGenerator } from "./pdfGenerator.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const contractBuilder = (attributeQuery: AttributeQuery) => ({
  createContract: async (
    agreement: Agreement,
    eService: EService,
    consumer: Tenant,
    producer: Tenant,
    seed: UpdateAgreementSeed
  ): Promise<ApiAgreementDocumentSeed> =>
    await pdfGenerator.createDocumentSeed(
      agreement,
      eService,
      consumer,
      producer,
      seed,
      attributeQuery
    ),
});

export type ContractBuilder = ReturnType<typeof contractBuilder>;

export async function addAgreementContractLogic(
  agreementId: string,
  agreementDocument: AgreementDocument,
  version: number
): Promise<CreateEvent<AgreementEvent>> {
  logger.info(
    `Adding contract ${agreementDocument.id} to Agreement ${agreementId}`
  );

  return toCreateEventAgreementContractAdded(
    agreementId,
    agreementDocument,
    version
  );
}
