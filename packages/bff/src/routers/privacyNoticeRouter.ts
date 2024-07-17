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
import { fromApiConsentType } from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { privacyNoticeServiceBuilder } from "../services/privacyNoticeService.js";
import { getPrivacyNoticeErrorMapper } from "../utilities/errorMappers.js";
import { PrivacyNoticeKind } from "../model/domain/types.js";
import { privacyNoticeStorageServiceBuilder } from "../services/privacyNoticeStorage.js";
import { config } from "../config/config.js";

const privacyNoticeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const privacyNoticeRouter = ctx.router(bffApi.privacyNoticesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const consentTypeMap: Map<PrivacyNoticeKind, string> = new Map([
    [PrivacyNoticeKind.PP, config.privacyNoticesPpUuid],
    [PrivacyNoticeKind.TOS, config.privacyNoticesTosUuid],
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
        const { consentType: consentTypeParam } = req.params;
        const { userId } = ctx.authData;
        const consentType = fromApiConsentType(consentTypeParam);

        const notice = await privacyNoticeService.getPrivacyNotice(
          consentType,
          userId,
          ctx.logger
        );
        return res.status(200).json(notice).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPrivacyNoticeErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/user/consent/:consentType", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const { consentType: consentTypeParam } = req.params;
        const { userId } = ctx.authData;
        const consentType = fromApiConsentType(consentTypeParam);

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
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/privacyNotices/:consentType", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const { consentType: consentTypeParam } = req.params;
        const consentType = fromApiConsentType(consentTypeParam);

        const file = await privacyNoticeService.getPrivacyNoticeContent(
          consentType,
          ctx.logger
        );
        return res.status(200).send(file).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPrivacyNoticeErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    });

  return privacyNoticeRouter;
};

export default privacyNoticeRouter;
