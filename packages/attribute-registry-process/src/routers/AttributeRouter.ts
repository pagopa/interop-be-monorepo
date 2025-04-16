import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  ReadModelRepository,
  initDB,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
  validateAuthorization,
  authRole,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { readModelServiceBuilder } from "../services/readModelService.js";
import {
  toAttributeKind,
  toApiAttribute,
} from "../model/domain/apiConverter.js";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { attributeRegistryServiceBuilder } from "../services/attributeRegistryService.js";
import {
  createCertifiedAttributesErrorMapper,
  createDeclaredAttributesErrorMapper,
  createInternalCertifiedAttributesErrorMapper,
  createVerifiedAttributesErrorMapper,
  getAttributeByIdErrorMapper,
  getAttributeByOriginAndCodeErrorMapper,
  getAttributesByNameErrorMapper,
} from "../utilities/errorMappers.js";

const readModelRepository = ReadModelRepository.init(config);
const readModelService = readModelServiceBuilder(readModelRepository);
export const attributeRegistryService = attributeRegistryServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  readModelService
);

const attributeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(attributeRegistryApi.attributeApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
  } = authRole;

  attributeRouter
    .get(
      "/attributes",

      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [
            ADMIN_ROLE,
            API_ROLE,
            SUPPORT_ROLE,
            SECURITY_ROLE,
            M2M_ROLE,
          ]);

          const { limit, offset, kinds, name, origin } = req.query;
          const attributes =
            await attributeRegistryService.getAttributesByKindsNameOrigin(
              {
                kinds: kinds.map(toAttributeKind),
                name,
                origin,
                offset,
                limit,
              },
              ctx
            );

          return res.status(200).send(
            attributeRegistryApi.Attributes.parse({
              results: attributes.results.map(toApiAttribute),
              totalCount: attributes.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/attributes/name/:name", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
        ]);

        const attribute = await attributeRegistryService.getAttributeByName(
          req.params.name,
          ctx
        );

        return res
          .status(200)
          .send(
            attributeRegistryApi.Attribute.parse(toApiAttribute(attribute.data))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAttributesByNameErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/attributes/origin/:origin/code/:code", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, SUPPORT_ROLE, M2M_ROLE]);

        const { origin, code } = req.params;
        const attribute =
          await attributeRegistryService.getAttributeByOriginAndCode(
            {
              origin,
              code,
            },
            ctx
          );

        return res
          .status(200)
          .send(
            attributeRegistryApi.Attribute.parse(toApiAttribute(attribute.data))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAttributeByOriginAndCodeErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get(
      "/attributes/:attributeId",

      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [
            ADMIN_ROLE,
            API_ROLE,
            SUPPORT_ROLE,
            SECURITY_ROLE,
            M2M_ROLE,
          ]);

          const attribute = await attributeRegistryService.getAttributeById(
            unsafeBrandId(req.params.attributeId),
            ctx
          );

          return res
            .status(200)
            .send(
              attributeRegistryApi.Attribute.parse(
                toApiAttribute(attribute.data)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAttributeByIdErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/bulk/attributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { limit, offset } = req.query;

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
        ]);

        const attributes = await attributeRegistryService.getAttributesByIds(
          {
            ids: req.body.map((a) => unsafeBrandId(a)),
            offset,
            limit,
          },
          ctx
        );
        return res.status(200).send(
          attributeRegistryApi.Attributes.parse({
            results: attributes.results.map(toApiAttribute),
            totalCount: attributes.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/certifiedAttributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ROLE]);

        const attribute =
          await attributeRegistryService.createCertifiedAttribute(
            req.body,
            ctx
          );
        return res
          .status(200)
          .send(
            attributeRegistryApi.Attribute.parse(toApiAttribute(attribute))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createCertifiedAttributesErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/declaredAttributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

        const attribute =
          await attributeRegistryService.createDeclaredAttribute(req.body, ctx);
        return res
          .status(200)
          .send(
            attributeRegistryApi.Attribute.parse(toApiAttribute(attribute))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createDeclaredAttributesErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/verifiedAttributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

        const attribute =
          await attributeRegistryService.createVerifiedAttribute(req.body, ctx);
        return res
          .status(200)
          .send(
            attributeRegistryApi.Attribute.parse(toApiAttribute(attribute))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createVerifiedAttributesErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/internal/certifiedAttributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [INTERNAL_ROLE]);

        const attribute =
          await attributeRegistryService.internalCreateCertifiedAttribute(
            req.body,
            ctx
          );
        return res
          .status(200)
          .send(
            attributeRegistryApi.Attribute.parse(toApiAttribute(attribute))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createInternalCertifiedAttributesErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return attributeRouter;
};
export default attributeRouter;
