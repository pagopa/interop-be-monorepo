import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  bffApi,
  selfcareV2UsersClientBuilder,
} from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  emptyErrorMapper,
  getProducerKeychainUsersErrorMapper,
} from "../utilities/errorMappers.js";
import { producerKeychainServiceBuilder } from "../services/producerKeychainService.js";
import { config } from "../config/config.js";
import { toBffApiCompactProducerKeychain } from "../model/api/converters/catalogClientApiConverter.js";

const producerKeychainRouter = (
  ctx: ZodiosContext,
  processClients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerKeychainRouter = ctx.router(bffApi.producerKeychainApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const producerKeychainService = producerKeychainServiceBuilder(
    processClients,
    selfcareV2UsersClientBuilder(config)
  );

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
    .post("/producerKeychains/:producerKeychainId/keys", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await producerKeychainService.createProducerKey(
          req.params.producerKeychainId,
          req.body,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/producerKeychains/:producerKeychainId/keys", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const keys = await producerKeychainService.getProducerKeys(
          req.params.producerKeychainId,
          req.query.userIds,
          ctx
        );

        return res.status(200).json({ keys }).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get(
      "/producerKeychains/:producerKeychainId/keys/:keyId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const key = await producerKeychainService.getProducerKeyById(
            req.params.producerKeychainId,
            req.params.keyId,
            ctx
          );

          return res.status(200).json(key).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/producerKeychains/:producerKeychainId/keys/:keyId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          await producerKeychainService.deleteProducerKeyById(
            req.params.producerKeychainId,
            req.params.keyId,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get("/producerKeychains/:producerKeychainId/users", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const users = await producerKeychainService.getProducerKeychainUsers(
          req.params.producerKeychainId,
          ctx
        );

        return res.status(200).json(users).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getProducerKeychainUsersErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post(
      "/producerKeychains/:producerKeychainId/users/:userId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const createdUser =
            await producerKeychainService.addProducerKeychainUser(
              req.params.userId,
              req.params.producerKeychainId,
              ctx
            );

          return res.status(200).json(createdUser);
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/producerKeychains/:producerKeychainId/users/:userId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          await producerKeychainService.removeProducerKeychainUser(
            req.params.producerKeychainId,
            req.params.userId,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/producerKeychains/:producerKeychainId/encoded/keys/:keyId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const key =
            await producerKeychainService.getEncodedProducerKeychainKeyById(
              req.params.producerKeychainId,
              req.params.keyId,
              ctx
            );

          return res.status(200).json(key).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            `Error retrieving key ${req.params.keyId} for producer keychain ${req.params.producerKeychainId}`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    );

  return producerKeychainRouter;
};

export default producerKeychainRouter;
