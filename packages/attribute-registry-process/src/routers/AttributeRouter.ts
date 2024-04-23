import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  ReadModelRepository,
  initDB,
  loggerAndMakeApiProblemBuilder,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import {
  toAttributeKind,
  toApiAttribute,
} from "../model/domain/apiConverter.js";
import { config } from "../utilities/config.js";
import { errorCodes } from "../model/domain/errors.js";
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
const attributeRegistryService = attributeRegistryServiceBuilder(
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

const serviceName = "attribute-registry-process";

const attributeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
  } = userRoles;
  attributeRouter
    .get(
      "/attributes",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const { logger } = loggerAndMakeApiProblemBuilder(
          serviceName,
          req.ctx,
          errorCodes
        );

        try {
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
              logger
            );

          return res
            .status(200)
            .json({
              results: attributes.results.map(toApiAttribute),
              totalCount: attributes.totalCount,
            })
            .end();
        } catch (error) {
          return res.status(500).end();
        }
      }
    )
    .get(
      "/attributes/name/:name",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const { logger, makeApiProblem } = loggerAndMakeApiProblemBuilder(
          serviceName,
          req.ctx,
          errorCodes
        );

        try {
          const attribute = await attributeRegistryService.getAttributeByName(
            req.params.name,
            logger
          );

          return res.status(200).json(toApiAttribute(attribute.data)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAttributesByNameErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )

    .get(
      "/attributes/origin/:origin/code/:code",
      authorizationMiddleware([
        ADMIN_ROLE,
        INTERNAL_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const { logger, makeApiProblem } = loggerAndMakeApiProblemBuilder(
          serviceName,
          req.ctx,
          errorCodes
        );

        try {
          const { origin, code } = req.params;
          const attribute =
            await attributeRegistryService.getAttributeByOriginAndCode(
              {
                origin,
                code,
              },
              logger
            );

          return res.status(200).json(toApiAttribute(attribute.data)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAttributeByOriginAndCodeErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )

    .get(
      "/attributes/:attributeId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const { logger, makeApiProblem } = loggerAndMakeApiProblemBuilder(
          serviceName,
          req.ctx,
          errorCodes
        );

        try {
          const attribute = await attributeRegistryService.getAttributeById(
            unsafeBrandId(req.params.attributeId),
            logger
          );

          return res.status(200).json(toApiAttribute(attribute.data)).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, getAttributeByIdErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/bulk/attributes",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const { logger } = loggerAndMakeApiProblemBuilder(
          serviceName,
          req.ctx,
          errorCodes
        );
        const { limit, offset } = req.query;

        try {
          const attributes = await attributeRegistryService.getAttributesByIds(
            {
              ids: req.body.map((a) => unsafeBrandId(a)),
              offset,
              limit,
            },
            logger
          );
          return res
            .status(200)
            .json({
              results: attributes.results.map(toApiAttribute),
              totalCount: attributes.totalCount,
            })
            .end();
        } catch (error) {
          return res.status(500).end();
        }
      }
    )
    .post(
      "/certifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE, M2M_ROLE]),
      async (req, res) => {
        const { logger, makeApiProblem } = loggerAndMakeApiProblemBuilder(
          serviceName,
          req.ctx,
          errorCodes
        );

        try {
          const attribute =
            await attributeRegistryService.createCertifiedAttribute(
              req.body,
              req.ctx.authData,
              req.ctx.correlationId,
              logger
            );
          return res.status(200).json(toApiAttribute(attribute)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createCertifiedAttributesErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/declaredAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (req, res) => {
        const { logger, makeApiProblem } = loggerAndMakeApiProblemBuilder(
          serviceName,
          req.ctx,
          errorCodes
        );

        try {
          const attribute =
            await attributeRegistryService.createDeclaredAttribute(
              req.body,
              req.ctx.authData,
              req.ctx.correlationId,
              logger
            );
          return res.status(200).json(toApiAttribute(attribute)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createDeclaredAttributesErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/verifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (req, res) => {
        const { logger, makeApiProblem } = loggerAndMakeApiProblemBuilder(
          serviceName,
          req.ctx,
          errorCodes
        );

        try {
          const attribute =
            await attributeRegistryService.createVerifiedAttribute(
              req.body,
              req.ctx.authData,
              req.ctx.correlationId,
              logger
            );
          return res.status(200).json(toApiAttribute(attribute)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createVerifiedAttributesErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/internal/certifiedAttributes",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const { logger, makeApiProblem } = loggerAndMakeApiProblemBuilder(
          serviceName,
          req.ctx,
          errorCodes
        );

        try {
          const attribute =
            await attributeRegistryService.createInternalCertifiedAttribute(
              req.body,
              req.ctx.correlationId,
              logger
            );
          return res.status(200).json(toApiAttribute(attribute)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createInternalCertifiedAttributesErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    );

  return attributeRouter;
};
export default attributeRouter;
