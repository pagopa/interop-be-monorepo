/* eslint-disable functional/immutable-data */
import { agreementApi, catalogApi } from "pagopa-interop-api-clients";
import { AgreementProcessClient } from "../providers/clientProvider.js";
import { Headers } from "../utilities/context.js";

export const getLatestAgreement = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eservice: catalogApi.EService,
  headers: Headers
): Promise<agreementApi.Agreement | undefined> => {
  const getAgreementsFrom = async (
    start: number
  ): Promise<agreementApi.Agreements> =>
    await agreementProcessClient.getAgreements({
      headers: { ...headers },
      queries: {
        consumersIds: consumerId,
        eservicesIds: eservice.id,
        offset: start,
        limit: 50,
      },
    });

  // Fetched all agreements in a recursive way
  const getAgreements = async (
    start: number
  ): Promise<agreementApi.Agreement[]> => {
    const agreements = (await getAgreementsFrom(start)).results;

    if (agreements.length >= 50) {
      return agreements.concat(await getAgreements(start + 50));
    }
    return agreements;
  };

  const allAgreements = await getAgreements(0);

  return allAgreements
    .sort((firstAgreement, secondAgreement) => {
      if (firstAgreement.version !== secondAgreement.version) {
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
      } else {
        return (
          new Date(secondAgreement.createdAt).getTime() -
          new Date(firstAgreement.createdAt).getTime()
        );
      }
    })
    .at(0);
};
