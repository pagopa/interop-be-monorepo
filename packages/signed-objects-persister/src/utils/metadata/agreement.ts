import { agreementApi } from "pagopa-interop-api-clients";
import {
  getInteropHeaders,
  Logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { CorrelationId, AgreementDocument } from "pagopa-interop-models";
import { getInteropBeClients } from "../../clients/clientProvider.js";

export const addAgreementSignedContract = async (
  contract: AgreementDocument,
  refreshableToken: RefreshableInteropToken,
  agreementId: string,
  correlationId: CorrelationId,
  logger: Logger
): Promise<void> => {
  logger.info(
    `addAgreementSignedContract: Agreement Document ${JSON.stringify(contract)}`
  );
  const contractSigned: agreementApi.SignedDocument = {
    ...contract,
    createdAt: new Date(contract.createdAt).toISOString(),
    signedAt: new Date().toISOString(),
  };
  const token = (await refreshableToken.get()).serialized;

  const { agreementProcessClient } = getInteropBeClients();

  await agreementProcessClient.addSignedAgreementContractMetadata(
    contractSigned,
    {
      params: { agreementId },
      headers: getInteropHeaders({
        token,
        correlationId,
      }),
    }
  );
};
