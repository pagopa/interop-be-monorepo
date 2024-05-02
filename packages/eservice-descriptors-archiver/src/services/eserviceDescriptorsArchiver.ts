import {
  InteropTokenGenerator,
  getContext,
  logger,
} from "pagopa-interop-commons";
import { Agreement, DescriptorId, EServiceId } from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { pluginToken } from "@zodios/plugins";
import { config } from "../utilities/config.js";
import { CatalogProcessClient } from "./catalogProcessClient.js";
import { ReadModelService } from "./readModelService.js";
import { archiveDescriptorsForArchivedAgreement } from "./archiveDescriptorsForArchivedAgreement.js";

type EServiceDescriptorsArchiver = {
  archiveDescriptorsForArchivedAgreement: (
    archivedAgreement: Agreement
  ) => Promise<void>;
};

export const eserviceDescriptorArchiverBuilder = async (
  tokenGenerator: InteropTokenGenerator,
  readModelService: ReadModelService,
  catalogProcessClient: CatalogProcessClient
): Promise<EServiceDescriptorsArchiver> => {
  const tokenPayloadSeed = {
    subject: config.subject,
    audience: config.audience,
    tokenIssuer: config.tokenIssuer,
    expirationInSeconds: config.secondsToExpire,
  };
  const token = await tokenGenerator.generateInternalToken(tokenPayloadSeed);

  catalogProcessClient.use(
    pluginToken({
      getToken: async () => token.serialized,
      renewToken: async () => {
        /*
          This function is called when the service responds with a 401,
          automatically renews the token, and executes the request again.
          more details: https://github.com/ecyrbe/zodios-plugins/blob/main/src/plugins.test.ts#L69
        */
        logger.info("Renewing token");

        const newToken = await tokenGenerator.generateInternalToken(
          tokenPayloadSeed
        );
        return newToken.serialized;
      },
    })
  );

  const archiveDescriptor = async (
    descriptorId: DescriptorId,
    eserviceId: EServiceId
  ): Promise<void> =>
    catalogProcessClient.archiveDescriptor(undefined, {
      params: {
        eServiceId: eserviceId,
        descriptorId,
      },
      headers: {
        "X-Correlation-Id": getContext().correlationId ?? uuidv4(),
      },
    });

  return {
    archiveDescriptorsForArchivedAgreement: async (
      archivedAgreement: Agreement
    ): Promise<void> => {
      logger.info(
        `Archiving eservice descriptor for archived Agreement ${archivedAgreement.id} - Descriptor ${archivedAgreement.descriptorId} - EService ${archivedAgreement.eserviceId}`
      );

      await archiveDescriptorsForArchivedAgreement(
        archivedAgreement,
        readModelService,
        archiveDescriptor
      );
    },
  };
};
