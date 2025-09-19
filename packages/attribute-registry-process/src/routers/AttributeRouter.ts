import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  initDB,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
  validateAuthorization,
  authRole,
  setMetadataVersionHeader,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  toAttributeKind,
  toApiAttribute,
} from "../model/domain/apiConverter.js";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  AttributeRegistryService,
  attributeRegistryServiceBuilder,
} from "../services/attributeRegistryService.js";
import {
  createCertifiedAttributesErrorMapper,
  createDeclaredAttributesErrorMapper,
  createInternalCertifiedAttributesErrorMapper,
  createVerifiedAttributesErrorMapper,
  getAttributeByIdErrorMapper,
  getAttributeByOriginAndCodeErrorMapper,
  getAttributesByNameErrorMapper,
} from "../utilities/errorMappers.js";
import { readModelServiceBuilderSQL } from "../services/readModelServiceSQL.js";

const readModelDB = makeDrizzleConnection(config);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  attributeReadModelServiceSQL,
  tenantReadModelServiceSQL,
});

const defaultAttributeRegistryService = attributeRegistryServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  readModelServiceSQL
);

const attributeRouter = (
  ctx: ZodiosContext,
  attributeRegistryService: AttributeRegistryService = defaultAttributeRegistryService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(attributeRegistryApi.attributeApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    M2M_ADMIN_ROLE,
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
            M2M_ADMIN_ROLE,
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
            M2M_ADMIN_ROLE,
            M2M_ROLE,
          ]);

          const { data, metadata } =
            await attributeRegistryService.getAttributeById(
              unsafeBrandId(req.params.attributeId),
              ctx
            );

          setMetadataVersionHeader(res, metadata);
          return res
            .status(200)
            .send(attributeRegistryApi.Attribute.parse(toApiAttribute(data)));
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
          M2M_ADMIN_ROLE,
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
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ROLE, M2M_ADMIN_ROLE]);

        const { data, metadata } =
          await attributeRegistryService.createCertifiedAttribute(
            req.body,
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(attributeRegistryApi.Attribute.parse(toApiAttribute(data)));
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
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

        const { data: attribute, metadata } =
          await attributeRegistryService.createDeclaredAttribute(req.body, ctx);

        setMetadataVersionHeader(res, metadata);

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
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

        const { data: attribute, metadata } =
          await attributeRegistryService.createVerifiedAttribute(req.body, ctx);

        setMetadataVersionHeader(res, metadata);

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
