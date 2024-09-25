import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import { attributeServiceBuilder } from "../services/attributeService.js";
import { emptyErrorMapper } from "../utilities/errorMappers.js";

const attributeRouter = (
  ctx: ZodiosContext,
  { attributeProcessClient }: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(bffApi.attributesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const attributeService = attributeServiceBuilder(attributeProcessClient);

  attributeRouter
    .post("/certifiedAttributes", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await attributeService.createCertifiedAttribute(
          req.body,
          ctx
        );

        return res.status(200).send(bffApi.Attribute.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error creating certified attribute with seed ${JSON.stringify(
            req.body
          )}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/verifiedAttributes", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await attributeService.createVerifiedAttribute(
          req.body,
          ctx
        );

        return res.status(200).send(bffApi.Attribute.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error creating verified attribute with seed ${JSON.stringify(
            req.body
          )}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/declaredAttributes", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await attributeService.createDeclaredAttribute(
          req.body,
          ctx
        );

        return res.status(200).send(bffApi.Attribute.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error creating declared attribute with seed ${JSON.stringify(
            req.body
          )}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/attributes", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const { q, offset, limit, kinds, origin } = req.query;

        const attributes = await attributeService.getAttributes(
          {
            name: q,
            offset,
            limit,
            kinds,
            origin,
          },
          ctx
        );

        return res.status(200).send(bffApi.Attributes.parse(attributes));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving attributes with name = ${req.query.q}, limit = ${req.query.limit}, offset = ${req.query.offset}, kinds = ${req.query.kinds}`
        );
        return res.status(errorRes.status).send();
      }
    })

    .get("/attributes/:attributeId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await attributeService.getAttributeById(
          req.params.attributeId,
          ctx
        );

        return res.status(200).send(bffApi.Attribute.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving attribute with id ${req.params.attributeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/attributes/origin/:origin/code/:code", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await attributeService.getAttributeByOriginAndCode(
          req.params.origin,
          req.params.code,
          ctx
        );

        return res.status(200).send(bffApi.Attribute.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving attribute with origin = ${req.params.origin} and code = ${req.params.code}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return attributeRouter;
};

export default attributeRouter;
