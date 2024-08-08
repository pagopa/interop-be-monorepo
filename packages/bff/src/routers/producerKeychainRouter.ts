import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { emptyErrorMapper } from "../utilities/errorMappers.js";
import { toBffApiCompactProducerKeychain } from "../model/api/apiConverter.js";
import { producerKeychainServiceBuilder } from "../services/producerKeychainService.js";

const producerKeychainRouter = (
  ctx: ZodiosContext,
  processClients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerKeychainRouter = ctx.router(bffApi.producerKeychainApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const producerKeychainService =
    producerKeychainServiceBuilder(processClients);

  producerKeychainRouter
    .get("/producerKeychains", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const requesterId = ctx.authData.organizationId;
        const { limit, offset, userIds, q } = req.query;
        const producerKeychains =
          await producerKeychainService.getProducerKeychains(
            {
              limit,
              offset,
              userIds,
              name: q,
              requesterId,
            },
            ctx
          );

        return res
          .status(200)
          .json({
            results: producerKeychains.results.map(
              toBffApiCompactProducerKeychain
            ),
            pagination: {
              limit,
              offset,
              totalCount: producerKeychains.totalCount,
            },
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/producerKeychains", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await producerKeychainService.createProducerKeychain(
          req.body,
          ctx
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/producerKeychains/:producerKeychainId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const producerKeychain =
          await producerKeychainService.getProducerKeychainById(
            req.params.producerKeychainId,
            ctx
          );

        return res.status(200).json(producerKeychain).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .delete("/producerKeychains/:producerKeychainId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await producerKeychainService.deleteProducerKeychain(
          req.params.producerKeychainId,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post(
      "/producerKeychains/:producerKeychainId/eservices",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          await producerKeychainService.addProducerKeychainEService(
            req.params.producerKeychainId,
            req.body,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/producerKeychains/:producerKeychainId/eservices/:eserviceId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await producerKeychainService.removeProducerKeychainEService(
            req.params.producerKeychainId,
            req.params.eserviceId,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post("/producerKeychains/:producerKeychainId/keys", async (_req, res) =>
      res.status(501).send()
    )
    .get("/producerKeychains/:producerKeychainId/keys", async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/producerKeychains/:producerKeychainId/keys/:keyId",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/producerKeychains/:producerKeychainId/keys/:keyId",
      async (_req, res) => res.status(501).send()
    )
    .get("/producerKeychains/:producerKeychainId/users", async (_req, res) =>
      res.status(501).send()
    )
    .post(
      "/producerKeychains/:producerKeychainId/users/:userId",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/producerKeychains/:producerKeychainId/users/:userId",
      async (_req, res) => res.status(501).send()
    );

  return producerKeychainRouter;
};

export default producerKeychainRouter;
