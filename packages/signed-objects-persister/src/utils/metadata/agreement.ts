import { agreementApi } from "pagopa-interop-api-clients";
import {
  getInteropHeaders,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { CorrelationId, AgreementDocument } from "pagopa-interop-models";

export const addAgreementSignedContract = async (
  contract: AgreementDocument,
  refreshableToken: RefreshableInteropToken,
  agreementId: string,
  correlationId: CorrelationId
): Promise<void> => {
  const contractWithIsoString = {
    ...contract,
    createdAt: contract.createdAt.toISOString(),
    signedAt: new Date().toISOString(),
  };
  const token = (await refreshableToken.get()).serialized;
  await agreementApi.agreementApi.addSignedAgreementContractMetadata(
    contractWithIsoString,
    {
      params: { agreementId },
      headers: getInteropHeaders({
        token,
        correlationId,
      }),
    }
  );
};
