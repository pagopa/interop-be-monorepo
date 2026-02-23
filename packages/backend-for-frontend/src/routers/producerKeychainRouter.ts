import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { emptyErrorMapper } from "pagopa-interop-models";
import { fromBffAppContext } from "../utilities/context.js";
import { makeApiProblem } from "../model/errors.js";
import { getProducerKeychainUsersErrorMapper } from "../utilities/errorMappers.js";
import { ProducerKeychainService } from "../services/producerKeychainService.js";

const producerKeychainRouter = (
  ctx: ZodiosContext,
  producerKeychainService: ProducerKeychainService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerKeychainRouter = ctx.router(bffApi.producerKeychainApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  producerKeychainRouter
    .get("/producerKeychains", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const { limit, offset, userIds, q, eserviceId } = req.query;

        const producerKeychains =
          await producerKeychainService.getProducerKeychains(
            {
              limit,
              offset,
              userIds,
              name: q,
              eserviceId,
            },
            ctx
          );

        return res
          .status(200)
          .send(bffApi.CompactProducerKeychains.parse(producerKeychains));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving producer keychains with name = ${
            req.query.q
          }, limit = ${req.query.limit}, offset = ${
            req.query.offset
          }, userIds = ${JSON.stringify(req.query.userIds)}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producerKeychains", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await producerKeychainService.createProducerKeychain(
          req.body,
          ctx
        );

        return res.status(200).send(bffApi.CreatedResource.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating producer keychain with seed: ${JSON.stringify(
            req.body
          )}`
        );
        return res.status(errorRes.status).send(errorRes);
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

        return res
          .status(200)
          .send(bffApi.ProducerKeychain.parse(producerKeychain));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving producer keychain with id = ${req.params.producerKeychainId}`
        );
        return res.status(errorRes.status).send(errorRes);
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
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error deleting producer keychain with id = ${req.params.producerKeychainId}`
        );
        return res.status(errorRes.status).send(errorRes);
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
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error adding EService ${req.body.eserviceId} to producer keychain ${req.params.producerKeychainId}`
          );
          return res.status(errorRes.status).send(errorRes);
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
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error removing EService ${req.params.eserviceId} from producer keychain ${req.params.producerKeychainId}`
          );
          return res.status(errorRes.status).send(errorRes);
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
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating producer key in producer keychain ${
            req.params.producerKeychainId
          } with seed: ${JSON.stringify(req.body)}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerKeychains/:producerKeychainId/keys", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const { userIds, limit, offset } = req.query;

      try {
        const keys = await producerKeychainService.getProducerKeys(
          {
            producerKeychainId: req.params.producerKeychainId,
            userIds,
            limit,
            offset,
          },
          ctx
        );

        return res.status(200).send(bffApi.PublicKeys.parse(keys));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving producer keys in producer keychain ${
            req.params.producerKeychainId
          } for user ids: ${JSON.stringify(req.query.userIds)}`
        );
        return res.status(errorRes.status).send(errorRes);
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

          return res.status(200).send(bffApi.PublicKey.parse(key));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving producer key ${req.params.keyId} in producer keychain ${req.params.producerKeychainId}`
          );
          return res.status(errorRes.status).send(errorRes);
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
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting producer key ${req.params.keyId} in producer keychain ${req.params.producerKeychainId}`
          );
          return res.status(errorRes.status).send(errorRes);
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

        return res.status(200).send(bffApi.CompactUsers.parse(users));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getProducerKeychainUsersErrorMapper,
          ctx,
          `Error retrieving users in producer keychain ${req.params.producerKeychainId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producerKeychains/:producerKeychainId/users", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await producerKeychainService.addProducerKeychainUsers(
          req.body.userIds,
          req.params.producerKeychainId,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error adding users ${req.body.userIds.join(
            ","
          )} to producer keychain ${req.params.producerKeychainId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
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
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error removing user ${req.params.userId} from producer keychain ${req.params.producerKeychainId}`
          );
          return res.status(errorRes.status).send(errorRes);
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

          return res.status(200).send(bffApi.EncodedClientKey.parse(key));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving key ${req.params.keyId} for producer keychain ${req.params.producerKeychainId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return producerKeychainRouter;
};

export default producerKeychainRouter;
