import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
} from "pagopa-interop-commons";
import { attributeNotFound } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import { ReadModelService } from "../services/readModelService.js";
import {
  apiAttributeKindToAttributeKind,
  attributeToApiAttribute,
} from "../model/domain/apiConverter.js";
import { ApiError, makeApiError } from "../model/types.js";
import { AttributeRegistryService } from "../services/attributeRegistryService.js";

const attributeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const readModelService = new ReadModelService();
  const attributeRegistryService = new AttributeRegistryService();

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

          const attributes = await readModelService.getAttributes(
            {
              ids: undefined,
              kinds: kinds.map(apiAttributeKindToAttributeKind),
              name,
              origin,
            },
            offset,
            limit
          );

          return res
            .status(200)
            .json({
              results: attributes.results.map(attributeToApiAttribute),
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
            return res
              .status(200)
              .json(attributeToApiAttribute(attribute.data))
              .end();
          } else {
            return res
              .status(404)
              .json(makeApiError(attributeNotFound(req.params.name)))
              .end();
          }
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
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
            return res
              .status(200)
              .json(attributeToApiAttribute(attribute.data))
              .end();
          } else {
            return res
              .status(404)
              .json(makeApiError(attributeNotFound(`${origin}/${code}`)))
              .end();
          }
        } catch (error) {
          return res.status(500).end();
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
            req.params.attributeId
          );

          if (attribute) {
            return res
              .status(200)
              .json(attributeToApiAttribute(attribute.data))
              .end();
          } else {
            return res
              .status(404)
              .json(makeApiError(attributeNotFound(req.params.attributeId)))
              .end();
          }
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
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
          const attributes = await readModelService.getAttributes(
            {
              ids: req.body,
              kinds: [],
            },
            offset,
            limit
          );
          return res
            .status(200)
            .json({
              results: attributes.results.map(attributeToApiAttribute),
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
      async (_req, res) => res.status(501).send()
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
          return res.status(201).json({ id }).end();
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
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
          return res.status(201).json({ id }).end();
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/internal/certifiedAttributes",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (_req, res) => res.status(501).send()
    );

  return attributeRouter;
};
export default attributeRouter;
