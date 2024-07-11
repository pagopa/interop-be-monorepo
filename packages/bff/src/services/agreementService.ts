/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { agreementApi, bffApi, catalogApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import {
  AgreementProcessClient,
  PagoPAInteropBeClients,
} from "../providers/clientProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";

export function agreementServiceBuilder(
  agreementClient: PagoPAInteropBeClients["agreementProcessClient"]
) {
  return {
    async createAgreement(
      payload: bffApi.AgreementPayload,
      { headers, logger }: WithLogger<BffAppContext>
    ) {
      logger.info(`Creating agreement with seed ${JSON.stringify(payload)}`);
      return await agreementClient.createAgreement(payload, {
        headers,
      });
    },
  };
}

export const getLatestAgreement = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eservice: catalogApi.EService,
  headers: Headers
): Promise<agreementApi.Agreement> => {
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

  return allAgreements.sort((firstAgreement, secondAgreement) => {
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
  })[0];
};
