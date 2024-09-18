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
import { TenantId, unsafeBrandId, UserId } from "pagopa-interop-models";
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
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { fromBffAppContext } from "../utilities/context.js";

const selfcareRouter = (
  clients: PagoPAInteropBeClients,
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const selfcareService = selfcareServiceBuilder(
    selfcareV2InstitutionClientBuilder(config),
    clients.tenantProcessClient
  );

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
          ctx.authData.selfcareId,
          ctx.logger
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
          `Error while retrieving user ${req.params.userId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/selfcare/institutions/products", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const products = await selfcareService.getSelfcareInstitutionsProducts(
          ctx.authData.userId,
          ctx.authData.selfcareId,
          ctx.logger
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
          ctx.authData.userId,
          ctx.logger
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
          `Error retrieving institutions`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/tenants/:tenantId/users", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const results = await selfcareService.getInstitutionUsers(
          unsafeBrandId<TenantId>(req.params.tenantId),
          req.query.personId,
          req.query.roles,
          req.query.query,
          ctx
        );

        return res.status(200).json(results).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareErrorMapper,
          ctx.logger,
          `Error while retrieving users corresponding to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    });

  return selfcareRouter;
};

export default selfcareRouter;
