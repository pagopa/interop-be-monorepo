/* eslint-disable no-console */
import { agreementApi } from "pagopa-interop-api-clients";

// export const addAgreementSignedContract = async (
//   agreementId: string,
//   document: agreementApi.DocumentSeed
// ): ReturnType<
//   typeof agreementApi.agreementApi.api.postAgreementSignedContract
// > =>
//   agreementApi.agreementApi.api.postAgreementSignedContract({
//     agreementId,
//     body: document,
//   });

type AgreementSignedContractResponse = {
  agreementId: string;
  document: agreementApi.DocumentSeed;
  event: "AgreementSignedContractAdded";
  timestamp: string;
};

export const addAgreementSignedContract = async (
  agreementId: string,
  document: agreementApi.DocumentSeed
): Promise<AgreementSignedContractResponse> => {
  console.log(`Mock: aggiungo signed contract all'agreement ${agreementId}`);
  console.log("Documento:", document);

  await new Promise((resolve) => setTimeout(resolve, 200));

  return {
    agreementId,
    document,
    event: "AgreementSignedContractAdded",
    timestamp: new Date().toISOString(),
  };
};
