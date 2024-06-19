/* eslint-disable functional/immutable-data */
import {
  AgreementProcessApiAgreement,
  AgreementProcessApiResponse,
} from "../model/api/agreementTypes.js";
import { BffGetCatalogApiHeaders } from "../model/api/bffTypes.js";
import { EServiceCatalogProcessApi } from "../model/api/catalogTypes.js";
import { AgreementProcessClient } from "../providers/clientProvider.js";

export const getLatestAgreement = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eservice: EServiceCatalogProcessApi,
  headers: BffGetCatalogApiHeaders
): Promise<AgreementProcessApiAgreement> => {
  const getAgreementsFrom = async (
    start: number
  ): Promise<AgreementProcessApiResponse> =>
    await agreementProcessClient.getAgreements({
      headers,
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
  ): Promise<AgreementProcessApiAgreement[]> => {
    const agreements = (await getAgreementsFrom(start)).results;

    if (agreements.length >= 50) {
      return agreements.concat(await getAgreements(start + 50));
    }
    return agreements;
  };

  const allAgreements = await getAgreements(0);

  return allAgreements.sort((firstAgreement, secondAgreement) => {
    if (firstAgreement.version !== secondAgreement.version) {
      return (
        new Date(secondAgreement.createdAt).getTime() -
        new Date(firstAgreement.createdAt).getTime()
      );
    } else {
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
    }
  })[0];
};
