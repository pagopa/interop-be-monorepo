/* eslint-disable functional/immutable-data */
/* eslint-disable max-params */
import { agreementApi, catalogApi } from "pagopa-interop-api-clients";
import { AgreementProcessClient } from "../providers/clientProvider.js";
import { Headers } from "../utilities/context.js";

// Fetched all agreements in a recursive way
export const getAllAgreements = async (
  agreementProcessClient: AgreementProcessClient,
  headers: Headers,
  consumerIds: string[] = [],
  eserviceIds: string[] = [],
  producerIds: string[] = [],
  states: agreementApi.AgreementState[] = [],
  start: number = 0
): Promise<agreementApi.Agreement[]> => {
  const agreements = (
    await getAgreementsFrom(
      agreementProcessClient,
      headers,
      start,
      consumerIds,
      eserviceIds,
      producerIds
    )
  ).results;

  if (agreements.length >= 50) {
    return agreements.concat(
      await getAllAgreements(
        agreementProcessClient,
        headers,
        consumerIds,
        eserviceIds,
        producerIds,
        states,
        start + 50
      )
    );
  }
  return agreements;
};

export const getAgreementsFrom = async (
  agreementProcessClient: AgreementProcessClient,
  headers: Headers,
  start: number,
  consumerIds?: string[],
  eserviceIds?: string[],
  producerIds?: string[],
  states: agreementApi.AgreementState[] = [],
  limit: number = 50
): Promise<agreementApi.Agreements> =>
  await agreementProcessClient.getAgreements({
    headers,
    queries: {
      consumersIds: consumerIds,
      producersIds: producerIds,
      eservicesIds: eserviceIds,
      states: states.join(","),
      offset: start,
      limit,
    },
  });

export const getLatestAgreement = async (
  agreementProcessClient: AgreementProcessClient,
  consumerId: string,
  eservice: catalogApi.EService,
  headers: Headers
): Promise<agreementApi.Agreement> => {
  const allAgreements = await getAllAgreements(
    agreementProcessClient,
    headers,
    [consumerId],
    [eservice.id]
  );

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
