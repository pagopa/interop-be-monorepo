import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
} from "pagopa-interop-commons";
import { selfcareV2ClientBuilder } from "pagopa-interop-selfcare-v2-client";
import { api } from "../model/generated/api.js";
import {
  toBffApiSelfcareInstitution,
  toBffApiSelfcareProduct,
  toBffApiSelfcareUser,
} from "../model/domain/apiConverter.js";
import { selfcareServiceBuilder } from "../services/selfcareService.js";
import { config } from "../utilities/config.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  getSelfcareErrorMapper,
  getSelfcareUserErrorMapper,
} from "../utilities/errorMappers.js";

const selfcareService = selfcareServiceBuilder(selfcareV2ClientBuilder(config));

const selfcareRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const selfcareRouter = ctx.router(api.api, {
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
          .json(toBffApiSelfcareUser(user, ctx.authData.organizationId))
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareUserErrorMapper,
          ctx.logger
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

        return res
          .status(200)
          .json(products.map(toBffApiSelfcareProduct))
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareErrorMapper,
          ctx.logger
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
          .json(institutions.map(toBffApiSelfcareInstitution))
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    });

  return selfcareRouter;
};

export default selfcareRouter;
