import { Agreement, AgreementId, WithMetadata } from "pagopa-interop-models";
import { AgreementReadModelService } from "pagopa-interop-readmodel";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  agreementReadModelService: AgreementReadModelService
) {
  return {
    async upsertAgreement(agreement: WithMetadata<Agreement>): Promise<void> {
      return await agreementReadModelService.upsertAgreement(agreement);
    },
    async deleteAgreement(
      agreementId: AgreementId,
      metadataVersion: number
    ): Promise<void> {
      return await agreementReadModelService.deleteAgreementById(
        agreementId,
        metadataVersion
      );
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
