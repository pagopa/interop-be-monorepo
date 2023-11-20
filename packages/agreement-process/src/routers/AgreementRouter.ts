import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  userRoles,
  authorizationMiddleware,
  initDB,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";
import {
  agreementToApiAgreement,
  apiAgreementStateToAgreementState,
} from "../model/domain/apiConverter.js";
import { config } from "../utilities/config.js";
import { agreementServiceBuilder } from "../services/agreementService.js";
import { agreementQueryBuilder } from "../services/readmodel/agreementQuery.js";
import { tenantQueryBuilder } from "../services/readmodel/tenantQuery.js";
import { eserviceQueryBuilder } from "../services/readmodel/eserviceQuery.js";
import { attributeQueryBuilder } from "../services/readmodel/attributeQuery.js";
import { readModelServiceBuilder } from "../services/readmodel/readModelService.js";
import { agreementNotFound, makeApiProblem } from "../model/domain/errors.js";
import {
  createAgreementErrorMapper,
  deleteAgreementErrorMapper,
  submitAgreementErrorMapper,
  updateAgreementErrorMapper,
  upgradeAgreementErrorMapper,
} from "../utilities/errorMappers.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const agreementQuery = agreementQueryBuilder(readModelService);
const tenantQuery = tenantQueryBuilder(readModelService);
const eserviceQuery = eserviceQueryBuilder(readModelService);
const attributeQuery = attributeQueryBuilder(readModelService);

const agreementService = agreementServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  agreementQuery,
  tenantQuery,
  eserviceQuery,
  attributeQuery
);

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

  agreementRouter.post(
    "/agreements/:agreementId/submit",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        const id = await agreementService.submitAgreement(
          req.params.agreementId,
          req.body
        );
        return res.status(200).json({ id }).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, submitAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

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
        const errorRes = makeApiProblem(error, createAgreementErrorMapper);
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
            eserviceId: req.query.eservicesIds,
            consumerId: req.query.consumersIds,
            producerId: req.query.producersIds,
            descriptorId: req.query.descriptorsIds,
            agreementStates: req.query.states.map(
              apiAgreementStateToAgreementState
            ),
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
        const errorRes = makeApiProblem(error, () => 500);
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
            .json(
              makeApiProblem(
                agreementNotFound(req.params.agreementId),
                () => 404
              )
            )
            .send();
        }
      } catch (error) {
        const errorRes = makeApiProblem(error, () => 500);
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
        const errorRes = makeApiProblem(error, deleteAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/update",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        await agreementService.updateAgreement(
          req.params.agreementId,
          req.body,
          req.ctx.authData
        );

        return res.status(200).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, updateAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/upgrade",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        await agreementService.upgradeAgreement(
          req.params.agreementId,
          req.ctx.authData
        );

        return res.status(200).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, upgradeAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
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
