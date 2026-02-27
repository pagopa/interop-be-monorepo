import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  authRole,
  validateAuthorization,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { AttributeService } from "../services/attributeService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import { getAttributeErrorMapper } from "../utils/errorMappers.js";

const { M2M_ADMIN_ROLE, M2M_ROLE } = authRole;

const attributeRouter = (
  ctx: ZodiosContext,
  attributeService: AttributeService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(m2mGatewayApi.attributesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  attributeRouter
    .get("/certifiedAttributes/:attributeId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const attribute = await attributeService.getCertifiedAttribute(
          req.params.attributeId,
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.CertifiedAttribute.parse(attribute));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAttributeErrorMapper,
          ctx,
          `Error retrieving certified attribute with id ${req.params.attributeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/declaredAttributes/:attributeId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const attribute = await attributeService.getDeclaredAttribute(
          req.params.attributeId,
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.DeclaredAttribute.parse(attribute));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAttributeErrorMapper,
          ctx,
          `Error retrieving declared attribute with id ${req.params.attributeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/verifiedAttributes/:attributeId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const attribute = await attributeService.getVerifiedAttribute(
          req.params.attributeId,
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.VerifiedAttribute.parse(attribute));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAttributeErrorMapper,
          ctx,
          `Error retrieving verified attribute with id ${req.params.attributeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/certifiedAttributes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const attribute = await attributeService.createCertifiedAttribute(
          req.body,
          ctx
        );
        return res
          .status(201)
          .send(m2mGatewayApi.CertifiedAttribute.parse(attribute));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error creating certified attribute"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/certifiedAttributes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const attributes = await attributeService.getCertifiedAttributes(
          req.query,
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.CertifiedAttributes.parse(attributes));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving certified attributes"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/declaredAttributes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const attributes = await attributeService.getDeclaredAttributes(
          req.query,
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.DeclaredAttributes.parse(attributes));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving declared attributes"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/verifiedAttributes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const attributes = await attributeService.getVerifiedAttributes(
          req.query,
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.VerifiedAttributes.parse(attributes));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving verified attributes"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/verifiedAttributes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const attribute = await attributeService.createVerifiedAttribute(
          req.body,
          ctx
        );
        return res
          .status(201)
          .send(m2mGatewayApi.VerifiedAttribute.parse(attribute));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error creating verified attribute"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/declaredAttributes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const attribute = await attributeService.createDeclaredAttribute(
          req.body,
          ctx
        );
        return res
          .status(201)
          .send(m2mGatewayApi.DeclaredAttribute.parse(attribute));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error creating declared attribute"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return attributeRouter;
};

export default attributeRouter;
