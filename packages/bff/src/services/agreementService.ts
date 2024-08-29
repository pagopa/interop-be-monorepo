/* eslint-disable functional/immutable-data */
/* eslint-disable max-params */
import { agreementApi, catalogApi } from "pagopa-interop-api-clients";
import { getAllFromPaginated } from "pagopa-interop-commons";
import { AgreementProcessClient } from "../providers/clientProvider.js";
import { Headers } from "../utilities/context.js";

export const getLatestAgreement = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eservice: catalogApi.EService,
  headers: Headers
): Promise<agreementApi.Agreement | undefined> => {
  const allAgreements = await getAllFromPaginated(
    async (offset: number, limit: number) =>
      agreementProcessClient.getAgreements({
        headers,
        queries: {
          consumersIds: [consumerId],
          eservicesIds: [eservice.id],
          limit,
          offset,
        },
      })
  );

  return allAgreements
    .sort((firstAgreement, secondAgreement) => {
      // TODO check version missing
      const descriptorFirstAgreement = eservice.descriptors.find(
        (d) => d.id === firstAgreement.descriptorId
      );
      const descriptorSecondAgreement = eservice.descriptors.find(
        (d) => d.id === secondAgreement.descriptorId
      );

      return descriptorFirstAgreement && descriptorSecondAgreement
        ? Number(descriptorSecondAgreement.version) -
            Number(descriptorFirstAgreement.version)
        : 0;
    })
    .at(0);
};
