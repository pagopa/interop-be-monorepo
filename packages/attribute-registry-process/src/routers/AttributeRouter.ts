import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import {
  toAttributeKind,
  toApiAttribute,
} from "../model/domain/apiConverter.js";
import { config } from "../utilities/config.js";
import { attributeNotFound, makeApiProblem } from "../model/domain/errors.js";
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

const readModelService = readModelServiceBuilder(config);
const attributeRegistryService = attributeRegistryServiceBuilder(
  config,
  readModelService
);

const attributeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(api.api);
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
        try {
          const { limit, offset, kinds, name, origin } = req.query;
          const attributes =
            await readModelService.getAttributesByKindsNameOrigin({
              kinds: kinds.map(toAttributeKind),
              name,
              origin,
              offset,
              limit,
            });

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
        try {
          const attribute = await readModelService.getAttributeByName(
            req.params.name
          );

          if (attribute) {
            return res.status(200).json(toApiAttribute(attribute.data)).end();
          } else {
            const errorRes = makeApiProblem(
              attributeNotFound,
              getAttributesByNameErrorMapper
            );
            return res.status(errorRes.status).json(errorRes).end();
          }
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
        try {
          const { origin, code } = req.params;

          const attribute = await readModelService.getAttributeByOriginAndCode({
            origin,
            code,
          });
          if (attribute) {
            return res.status(200).json(toApiAttribute(attribute.data)).end();
          } else {
            const errorRes = makeApiProblem(
              attributeNotFound(`${origin}/${code}`),
              getAttributeByOriginAndCodeErrorMapper
            );
            return res.status(errorRes.status).json(errorRes).end();
          }
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
        try {
          const attribute = await readModelService.getAttributeById(
            unsafeBrandId(req.params.attributeId)
          );

          if (attribute) {
            return res.status(200).json(toApiAttribute(attribute.data)).end();
          } else {
            const errorRes = makeApiProblem(
              attributeNotFound(req.params.attributeId),
              getAttributeByIdErrorMapper
            );
            return res.status(errorRes.status).json(errorRes).end();
          }
        } catch (error) {
          const errorRes = makeApiProblem(
            attributeNotFound(req.params.attributeId),
            getAttributeByIdErrorMapper
          );
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
        const { limit, offset } = req.query;

        try {
          const attributes = await readModelService.getAttributesByIds({
            ids: req.body.map((a) => unsafeBrandId(a)),
            offset,
            limit,
          });
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
      authorizationMiddleware([ADMIN_ROLE, API_ROLE, M2M_ROLE]),
      async (req, res) => {
        try {
          const id = await attributeRegistryService.createCertifiedAttribute(
            req.body,
            req.ctx.authData
          );
          return res.status(200).json({ id }).end();
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
        try {
          const id = await attributeRegistryService.createDeclaredAttribute(
            req.body,
            req.ctx.authData
          );
          return res.status(200).json({ id }).end();
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
        try {
          const id = await attributeRegistryService.createVerifiedAttribute(
            req.body,
            req.ctx.authData
          );
          return res.status(200).json({ id }).end();
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
        try {
          const id =
            await attributeRegistryService.createInternalCertifiedAttribute(
              req.body
            );
          return res.status(200).json({ id }).end();
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
