import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  fromAppContext,
  initFileManager,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { bffApi } from "pagopa-interop-api-clients";
import { makeApiProblem } from "../model/errors.js";
import { privacyNoticeServiceBuilder } from "../services/privacyNoticeService.js";
import { getPrivacyNoticeErrorMapper } from "../utilities/errorMappers.js";
import { privacyNoticeStorageServiceBuilder } from "../services/privacyNoticeStorage.js";
import { config } from "../config/config.js";

const privacyNoticeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const privacyNoticeRouter = ctx.router(bffApi.privacyNoticesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const consentTypeMap: Map<bffApi.ConsentType, string> = new Map([
    [bffApi.ConsentType.Values.PP, config.privacyNoticesPpUuid],
    [bffApi.ConsentType.Values.TOS, config.privacyNoticesTosUuid],
  ]);
  const privacyNoticeStorage = privacyNoticeStorageServiceBuilder(
    new DynamoDBClient(),
    config.privacyNoticesDynamoTableName,
    config.privacyNoticesUsersDynamoTableName
  );

  const privacyNoticeService = privacyNoticeServiceBuilder(
    privacyNoticeStorage,
    initFileManager(config),
    consentTypeMap
  );

  privacyNoticeRouter
    .get("/user/consent/:consentType", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const { consentType } = req.params;
        const { userId } = ctx.authData;

        const notice = await privacyNoticeService.getPrivacyNotice(
          consentType,
          userId,
          ctx.logger
        );
        return res.status(200).json(bffApi.PrivacyNotice.parse(notice)).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPrivacyNoticeErrorMapper,
          ctx.logger,
          `Error retrieving privacy notices for consentType ${req.params.consentType}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/user/consent/:consentType", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const { consentType } = req.params;
        const { userId } = ctx.authData;

        await privacyNoticeService.acceptPrivacyNotice(
          consentType,
          userId,
          req.body,
          ctx.logger
        );
        return res.status(204).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPrivacyNoticeErrorMapper,
          ctx.logger,
          `Error accepting privacy notices for consentType ${req.params.consentType}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/privacyNotices/:consentType", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const { consentType } = req.params;

        const file = await privacyNoticeService.getPrivacyNoticeContent(
          consentType,
          ctx.logger
        );
        return res.status(200).send(file).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPrivacyNoticeErrorMapper,
          ctx.logger,
          `Error retrieving privacy notices content for consentType ${req.params.consentType}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    });

  return privacyNoticeRouter;
};

export default privacyNoticeRouter;
