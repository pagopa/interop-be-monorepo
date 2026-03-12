import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { makeApiProblem } from "../model/errors.js";
import { PrivacyNoticeService } from "../services/privacyNoticeService.js";
import { getPrivacyNoticeErrorMapper } from "../utilities/errorMappers.js";
import { fromBffAppContext } from "../utilities/context.js";

const privacyNoticeRouter = (
  ctx: ZodiosContext,
  privacyNoticeService: PrivacyNoticeService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const privacyNoticeRouter = ctx.router(bffApi.privacyNoticesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  privacyNoticeRouter
    .get("/user/consent/:consentType", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const { consentType } = req.params;
        const notice = await privacyNoticeService.getPrivacyNotice(
          consentType,
          ctx
        );
        return res.status(200).send(bffApi.PrivacyNotice.parse(notice));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPrivacyNoticeErrorMapper,
          ctx,
          `Error retrieving privacy notices for consentType ${req.params.consentType}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/user/consent/:consentType", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const { consentType } = req.params;

        await privacyNoticeService.acceptPrivacyNotice(
          consentType,
          req.body,
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPrivacyNoticeErrorMapper,
          ctx,
          `Error accepting privacy notices for consentType ${req.params.consentType}`
        );
        return res.status(errorRes.status).send(errorRes);
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
        return res.status(200).send(file);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPrivacyNoticeErrorMapper,
          ctx,
          `Error retrieving privacy notices content for consentType ${req.params.consentType}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return privacyNoticeRouter;
};

export default privacyNoticeRouter;
