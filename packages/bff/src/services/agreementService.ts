import {
  AgreementProcessApiAgreement,
  AgreementProcessApiResponse,
} from "../model/api/agreementTypes.js";
import { CatalogProcessApiEService } from "../model/api/catalogTypes.js";
import { AgreementProcessClient } from "../providers/clientProvider.js";

export const getAllAgreements = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eserviceId: string,
  headers: { "X-Correlation-Id": string }
): Promise<AgreementProcessApiAgreement[]> => {
  const getAgreementsFrom = async (
    start: number
  ): Promise<AgreementProcessApiResponse> =>
    await agreementProcessClient.getAgreements({
      headers,
      queries: {
        consumersIds: consumerId,
        eservicesIds: eserviceId,
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

  return await getAgreements(0);
};

export const getLatestAgreement = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eservice: CatalogProcessApiEService,
  headers: { "X-Correlation-Id": string }
): Promise<AgreementProcessApiAgreement | undefined> => {
  const agreements = await getAllAgreements(
    agreementProcessClient,
    consumerId,
    eservice.id,
    headers
  );

  const filtered = agreements
    .map((a) => {
      const version = eservice.descriptors.find(
        (d) => d.id === a.descriptorId
      )?.version;

      return {
        agreement: a,
        version: version ? Number(version) : undefined,
      };
    })
    .filter((a) => a.version !== undefined);

  // eslint-disable-next-line functional/immutable-data
  filtered.sort((a, b) => {
    if (a.version === undefined || b.version === undefined) {
      return 0;
    }

    const versionDiff = b.version - a.version;
    if (versionDiff !== 0) {
      return versionDiff;
    }

    const dateA = new Date(a.agreement.createdAt).getTime();
    const dateB = new Date(b.agreement.createdAt).getTime();
    return dateA - dateB;
  });

  // eslint-disable-next-line functional/immutable-data
  return filtered.pop()?.agreement;
};
