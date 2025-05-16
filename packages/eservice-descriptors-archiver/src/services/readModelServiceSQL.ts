import {
  Agreement,
  DescriptorId,
  EService,
  EServiceId,
  agreementState,
} from "pagopa-interop-models";
import {
  AgreementReadModelService,
  CatalogReadModelService,
} from "pagopa-interop-readmodel";
import { and, eq, ne } from "drizzle-orm";
import { agreementInReadmodelAgreement } from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
}: {
  agreementReadModelServiceSQL: AgreementReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
}) {
  return {
    async getNonArchivedAgreementsByEserviceAndDescriptorId(
      eserviceId: EServiceId,
      descriptorId: DescriptorId
    ): Promise<Agreement[]> {
      return (
        await agreementReadModelServiceSQL.getAgreementsByFilter(
          and(
            eq(agreementInReadmodelAgreement.eserviceId, eserviceId),
            eq(agreementInReadmodelAgreement.descriptorId, descriptorId),
            ne(agreementInReadmodelAgreement.state, agreementState.archived)
          )
        )
      ).map((a) => a.data);
    },
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
