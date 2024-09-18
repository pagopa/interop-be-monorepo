import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
} from "pagopa-interop-commons";
import {
  bffApi,
  selfcareV2InstitutionClientBuilder,
} from "pagopa-interop-api-clients";
import { makeApiProblem } from "../model/errors.js";
import {
  getSelfcareErrorMapper,
  getSelfcareUserErrorMapper,
} from "../utilities/errorMappers.js";
import { selfcareServiceBuilder } from "../services/selfcareService.js";
import { config } from "../config/config.js";
import {
  toApiSelfcareUser,
  toApiSelfcareProduct,
  toApiSelfcareInstitution,
} from "../api/selfcareApiConverter.js";

const selfcareService = selfcareServiceBuilder(
  selfcareV2InstitutionClientBuilder(config)
);

const selfcareRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const selfcareRouter = ctx.router(bffApi.selfcareApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  selfcareRouter
    .get("/users/:userId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const user = await selfcareService.getSelfcareUser(
          ctx.authData.userId,
          req.params.userId,
          ctx.authData.selfcareId
        );

        return res
          .status(200)
          .json(toApiSelfcareUser(user, ctx.authData.organizationId))
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareUserErrorMapper,
          ctx.logger,
          "Error retrieving user"
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/selfcare/institutions/products", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const products = await selfcareService.getSelfcareInstitutionsProducts(
          ctx.authData.userId,
          ctx.authData.selfcareId
        );

        return res.status(200).json(products.map(toApiSelfcareProduct)).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareErrorMapper,
          ctx.logger,
          "Error retrieving products for institution"
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/selfcare/institutions", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const institutions = await selfcareService.getSelfcareInstitutions(
          ctx.authData.userId
        );

        return res
          .status(200)
          .json(institutions.map(toApiSelfcareInstitution))
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareErrorMapper,
          ctx.logger,
          "Error retrieving institutions"
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    });

  return selfcareRouter;
};

export default selfcareRouter;
