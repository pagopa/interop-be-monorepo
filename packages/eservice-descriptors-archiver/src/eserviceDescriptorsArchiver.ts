import {
  JWTSeedConfig,
  buildInteropTokenGenerator,
  logger,
} from "pagopa-interop-commons";
import { Agreement } from "pagopa-interop-models";

type EServiceDescriptorsArchiver = {
  archiveDescriptorsForArchivedAgreement: (
    archivedAgreement: Agreement
  ) => Promise<void>;
};

export const eserviceDescriptorArchiverBuilder = async (
  jwtConfig: JWTSeedConfig
): Promise<EServiceDescriptorsArchiver> => {
  const tokenGenerator = buildInteropTokenGenerator();

  const tokenPayloadSeed = {
    subject: jwtConfig.subject,
    audience: jwtConfig.audience,
    tokenIssuer: jwtConfig.tokenIssuer,
    expirationInSeconds: jwtConfig.secondsToExpire,
  };
  const token = await tokenGenerator.generateInternalToken(tokenPayloadSeed);

  return {
    archiveDescriptorsForArchivedAgreement: async (
      archivedAgreement: Agreement
    ): Promise<void> => {
      logger.info(
        `Archiving eservice descriptors for agreement ${archivedAgreement.id}`
      );
      // TODO implement
    },
  };
};
