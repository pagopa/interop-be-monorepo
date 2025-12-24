import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  validateAuthorization,
  authRole,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { ProducerKeychainService } from "../services/producerKeychainService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";

const { M2M_ROLE, M2M_ADMIN_ROLE } = authRole;

const producerKeychainRouter = (
  ctx: ZodiosContext,
  producerKeychainService: ProducerKeychainService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerKeychainRouter = ctx.router(
    m2mGatewayApiV3.producerKeychainsApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  producerKeychainRouter
    .get("/producerKeychains", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const producerKeychains =
          await producerKeychainService.getProducerKeychains(req.query, ctx);

        return res
          .status(200)
          .send(m2mGatewayApiV3.ProducerKeychains.parse(producerKeychains));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving producer keychains"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerKeychains/:keychainId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const producerKeychain =
          await producerKeychainService.getProducerKeychain(
            unsafeBrandId(req.params.keychainId),
            ctx
          );
        return res
          .status(200)
          .send(m2mGatewayApiV3.ProducerKeychain.parse(producerKeychain));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving producer keychain with id ${req.params.keychainId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerKeychains/:keychainId/eservices", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const eservices =
          await producerKeychainService.getProducerKeychainEServices(
            unsafeBrandId(req.params.keychainId),
            req.query,
            ctx
          );
        return res.status(200).send(m2mGatewayApiV3.EServices.parse(eservices));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving e-services for producer keychain with id ${req.params.keychainId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerKeychains/:keychainId/keys", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const keys = await producerKeychainService.getProducerKeychainKeys(
          unsafeBrandId(req.params.keychainId),
          req.query,
          ctx
        );
        return res.status(200).send(m2mGatewayApiV3.JWKs.parse(keys));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving keys for producer keychain with id ${req.params.keychainId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producerKeychains/:keychainId/eservices", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        await producerKeychainService.addProducerKeychainEService(
          unsafeBrandId(req.params.keychainId),
          req.body,
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error adding e-service to producer keychain with id ${req.params.keychainId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/producerKeychains/:keychainId/eservices/:eserviceId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await producerKeychainService.removeProducerKeychainEService(
            unsafeBrandId(req.params.keychainId),
            unsafeBrandId(req.params.eserviceId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error removing e-service with id ${req.params.eserviceId} from producer keychain with id ${req.params.keychainId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return producerKeychainRouter;
};

export default producerKeychainRouter;
