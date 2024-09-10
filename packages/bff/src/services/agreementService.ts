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

  type AgreementAndDescriptor = {
    agreement: agreementApi.Agreement;
    descriptor: catalogApi.EServiceDescriptor;
  };

  const agreementAndDescriptor = allAgreements.reduce<AgreementAndDescriptor[]>(
    (acc, agreement) => {
      const descriptor = eservice.descriptors.find(
        (d) => d.id === agreement.descriptorId
      );
      if (descriptor) {
        acc.push({ agreement, descriptor });
      }
      return acc;
    },
    []
  );

  return agreementAndDescriptor
    .sort((first, second) => {
      const descriptorFirstAgreement = first.descriptor;
      const descriptorSecondAgreement = second.descriptor;
      if (
        descriptorFirstAgreement.version !== descriptorSecondAgreement.version
      ) {
        return (
          Number(descriptorSecondAgreement.version) -
          Number(descriptorFirstAgreement.version)
        );
      } else {
        return (
          new Date(second.agreement.createdAt).getTime() -
          new Date(first.agreement.createdAt).getTime()
        );
      }
    })
    .at(0)?.agreement;
};
