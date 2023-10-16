import { logger } from "pagopa-interop-commons";
import { PersistentAgreement } from "pagopa-interop-models";
import { readModelService } from "./readModelService.js";

export const agreementService = {
  async getAgreementById(
    agreementId: string
  ): Promise<PersistentAgreement | undefined> {
    logger.info(`Retrieving agreement by id ${agreementId}`);

    const agreement = await readModelService.readAgreementById(agreementId);
    return agreement?.data;
  },
};
