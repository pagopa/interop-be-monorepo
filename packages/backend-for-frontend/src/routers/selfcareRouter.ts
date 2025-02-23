import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  bffApi,
  selfcareV2InstitutionClientBuilder,
  selfcareV2UsersClientBuilder,
} from "pagopa-interop-api-clients";
import { TenantId, unsafeBrandId } from "pagopa-interop-models";
import { z } from "zod";
import { makeApiProblem } from "../model/errors.js";
import {
  getSelfcareErrorMapper,
  getSelfcareUserErrorMapper,
} from "../utilities/errorMappers.js";
import { selfcareServiceBuilder } from "../services/selfcareService.js";
import { config } from "../config/config.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { fromBffAppContext } from "../utilities/context.js";

const selfcareRouter = (
  clients: PagoPAInteropBeClients,
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const selfcareService = selfcareServiceBuilder(
    selfcareV2InstitutionClientBuilder(config),
    selfcareV2UsersClientBuilder(config),
    clients.tenantProcessClient
  );

  const selfcareRouter = ctx.router(bffApi.selfcareApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  selfcareRouter
    .get("/users/:userId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const user = await selfcareService.getSelfcareUser(
          req.params.userId,
          ctx
        );

        return res.status(200).send(bffApi.User.parse(user));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareUserErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error while retrieving user ${req.params.userId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/selfcare/institutions/products", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const products = await selfcareService.getSelfcareInstitutionsProducts(
          ctx
        );

        return res
          .status(200)
          .send(z.array(bffApi.SelfcareProduct).parse(products));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareErrorMapper,
          ctx.logger,
          ctx.correlationId,
          "Error retrieving products for institution"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/selfcare/institutions", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const institutions = await selfcareService.getSelfcareInstitutions(ctx);

        return res
          .status(200)
          .send(z.array(bffApi.SelfcareInstitution).parse(institutions));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving institutions`
        );
        return res.status(errorRes.status).send(errorRes);
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

        return res.status(200).send(bffApi.Users.parse(results));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getSelfcareErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error while retrieving users corresponding to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return selfcareRouter;
};

export default selfcareRouter;
