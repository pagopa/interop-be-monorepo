/* eslint-disable no-console */
import { agreementApi } from "pagopa-interop-api-clients";

// export const addDelegationSignedContract = async (
//   delegationId: string,
//   document: agreementApi.DocumentSeed
// ): Promise<unknown> =>
//   delegationApi.delegationApi.api.postDelegationSignedContract({
//     delegationId,
//     body: document,
//   });

type DelegationSignedContractResponse = {
  delegationId: string;
  document: agreementApi.DocumentSeed;
  event: "DelegationSignedContractAdded";
  timestamp: string;
};

export const addDelegationSignedContract = async (
  delegationId: string,
  document: agreementApi.DocumentSeed
): Promise<DelegationSignedContractResponse> => {
  console.log(`Mock: aggiungo signed contract alla delega ${delegationId}`);
  console.log("Documento:", document);

  await new Promise((resolve) => setTimeout(resolve, 200));

  return {
    delegationId,
    document,
    event: "DelegationSignedContractAdded",
    timestamp: new Date().toISOString(),
  };
};
