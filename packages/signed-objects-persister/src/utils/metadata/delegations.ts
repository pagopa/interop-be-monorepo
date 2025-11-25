/* eslint-disable no-console */
import { delegationApi } from "pagopa-interop-api-clients";
import {
  getInteropHeaders,
  Logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  DelegationContractDocument,
  generateId,
} from "pagopa-interop-models";
import { getInteropBeClients } from "../../clients/clientProvider.js";

export const addDelegationSignedContract = async (
  contract: DelegationContractDocument,
  refreshableToken: RefreshableInteropToken,
  delegationId: string,
  correlationId: CorrelationId,
  logger: Logger
): Promise<void> => {
  logger.info(
    `addDelegationSignedContract: Delegation Document ${JSON.stringify(
      contract
    )}`
  );

  const contractSigned: delegationApi.DelegationSignedContractDocument = {
    ...contract,
    id: generateId(),
    createdAt: new Date(contract.createdAt).toISOString(),
    signedAt: new Date().toISOString(),
  };
  const token = (await refreshableToken.get()).serialized;

  const { delegationProcessClient } = getInteropBeClients();

  await delegationProcessClient.delegation.addSignedDelegationContractMetadata(
    contractSigned,
    {
      params: { delegationId },
      headers: getInteropHeaders({
        token,
        correlationId,
      }),
    }
  );
};
