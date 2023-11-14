import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  userRoles,
  authorizationMiddleware,
} from "pagopa-interop-commons";
import { agreementNotFound } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import {
  agreementToApiAgreement,
  apiAgreementStateToAgreementState,
} from "../model/domain/apiConverter.js";
import { ApiError, makeApiError } from "../model/types.js";
import { AgreementService } from "../services/agreementService.js";

const agreementService = new AgreementService();

const {
  ADMIN_ROLE,
  SECURITY_ROLE,
  API_ROLE,
  M2M_ROLE,
  INTERNAL_ROLE,
  SUPPORT_ROLE,
} = userRoles;

const agreementRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const agreementRouter = ctx.router(api.api);

  agreementRouter.post("/agreements/:agreementId/submit", async (_req, res) => {
    res.status(501).send();
  });

  agreementRouter.post(
    "/agreements/:agreementId/activate",
    async (_req, res) => {
      res.status(501).send();
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/consumer-documents",
    async (_req, res) => {
      res.status(501).send();
    }
  );

  agreementRouter.get(
    "/agreements/:agreementId/consumer-documents/:documentId",
    async (_req, res) => {
      res.status(501).send();
    }
  );

  agreementRouter.delete(
    "/agreements/:agreementId/consumer-documents/:documentId",
    async (_req, res) => {
      res.status(501).send();
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/suspend",
    async (_req, res) => {
      res.status(501).send();
    }
  );

  agreementRouter.post("/agreements/:agreementId/reject", async (_req, res) => {
    res.status(501).send();
  });

  agreementRouter.post(
    "/agreements/:agreementId/archive",
    async (_req, res) => {
      res.status(501).send();
    }
  );

  agreementRouter.post(
    "/agreements",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        const id = await agreementService.createAgreement(
          req.body,
          req.ctx.authData
        );
        return res.status(200).json({ id }).send();
      } catch (error) {
        const errorRes: ApiError = makeApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.get(
    "/agreements",
    authorizationMiddleware([
      ADMIN_ROLE,
      API_ROLE,
      SECURITY_ROLE,
      M2M_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      try {
        const agreements = await agreementService.getAgreements(
          {
            eServicesIds: req.query.eservicesIds,
            consumersIds: req.query.consumersIds,
            producersIds: req.query.producersIds,
            descriptorsIds: req.query.descriptorsIds,
            states: req.query.states.map(apiAgreementStateToAgreementState),
            showOnlyUpgradeable: req.query.showOnlyUpgradeable || false,
          },
          req.query.limit,
          req.query.offset
        );

        return res
          .status(200)
          .json({
            results: agreements.results.map(agreementToApiAgreement),
            totalCount: agreements.totalCount,
          })
          .end();
      } catch (error) {
        const errorRes: ApiError = makeApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.get("/producers", async (_req, res) => {
    res.status(501).send();
  });

  agreementRouter.get("/consumers", async (_req, res) => {
    res.status(501).send();
  });

  agreementRouter.get(
    "/agreements/:agreementId",
    authorizationMiddleware([
      ADMIN_ROLE,
      API_ROLE,
      SECURITY_ROLE,
      M2M_ROLE,
      INTERNAL_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      try {
        const agreement = await agreementService.getAgreementById(
          req.params.agreementId
        );
        if (agreement) {
          return res
            .status(200)
            .json(agreementToApiAgreement(agreement))
            .send();
        } else {
          return res
            .status(404)
            .json(makeApiError(agreementNotFound(req.params.agreementId)))
            .send();
        }
      } catch (error) {
        const errorRes: ApiError = makeApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.delete(
    "/agreements/:agreementId",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        await agreementService.deleteAgreementById(
          req.params.agreementId,
          req.ctx.authData
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes: ApiError = makeApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post("/agreements/:agreementId/update", async (_req, res) => {
    res.status(501).send();
  });

  agreementRouter.post(
    "/agreements/:agreementId/upgrade",
    async (_req, res) => {
      res.status(501).send();
    }
  );

  agreementRouter.post("/agreements/:agreementId/clone", async (_req, res) => {
    res.status(501).send();
  });

  agreementRouter.post("/compute/agreementsState", async (_req, res) => {
    res.status(501).send();
  });

  agreementRouter.get("/agreements/filter/eservices", async (_req, res) => {
    res.status(501).send();
  });

  return agreementRouter;
};
export default agreementRouter;
