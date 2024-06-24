import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { attributeServiceBuilder } from "../services/attributeService.js";
import { attributeEmptyErrorMapper } from "../utilities/errorMapper.js";
import { makeApiProblem } from "../model/domain/errors.js";

const attributeRouter = (
  ctx: ZodiosContext,
  { attributeProcessClient }: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const attributeService = attributeServiceBuilder(attributeProcessClient);

  attributeRouter
    .post("/certifiedAttributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };
        const result = await attributeService.createCertifiedAttribute(
          req.body,
          headers,
          ctx.logger
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          attributeEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/verifiedAttributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };
        const result = await attributeService.createVerifiedAttribute(
          req.body,
          headers,
          ctx.logger
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          attributeEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/declaredAttributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        const result = await attributeService.createDeclaredAttribute(
          req.body,
          headers,
          ctx.logger
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          attributeEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/attributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };
        const { q, offset, limit, kinds, origin } = req.query;

        const attributes = await attributeService.getAttributes({
          name: q,
          offset,
          limit,
          kinds,
          origin,
          headers,
          logger: ctx.logger,
        });

        return res
          .json({
            results: attributes.results,
            pagination: { offset, limit, totalCount: attributes.totalCount },
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          attributeEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).end();
      }
    })

    .get("/attributes/:attributeId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };
        const result = await attributeService.getAttributeById(
          req.params.attributeId,
          headers,
          ctx.logger
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          attributeEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/attributes/origin/:origin/code/:code", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };
        const result = await attributeService.getAttributeByOriginAndCode(
          req.params.origin,
          req.params.code,
          headers,
          ctx.logger
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          attributeEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    });

  return attributeRouter;
};

export default attributeRouter;
