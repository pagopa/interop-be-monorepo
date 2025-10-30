/* eslint-disable no-console */
import { delegationApi } from "pagopa-interop-api-clients";
import {
  getInteropHeaders,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  DelegationContractDocument,
} from "pagopa-interop-models";

export const addDelegationSignedContract = async (
  contract: DelegationContractDocument,
  refreshableToken: RefreshableInteropToken,
  delegationId: string,
  correlationId: CorrelationId
): Promise<void> => {
  const contractWithIsoString = {
    ...contract,
    createdAt: contract.createdAt.toISOString(),
    signedAt: new Date().toISOString(),
  };
  const token = (await refreshableToken.get()).serialized;

  await delegationApi.delegationApi.addSignedDelegationContractMetadata(
    contractWithIsoString,
    {
      params: { delegationId },
      headers: getInteropHeaders({
        token,
        correlationId,
      }),
    }
  );
};
