import * as Effect from "@effect/io/Effect";
import { pipe } from "@effect/data/Function";
import { zodiosRouter } from "@zodios/express";
import { Response } from "express";
import { api } from "../model/generated/api.js";
import {
  makeGenericErrorProblem,
  mapCatalogServiceErrorToApiError,
} from "../model/types.js";
import { catalogService } from "../services/CatalogService.js";
import { db, DB } from "../repositories/db.js";
import { CatalogProcessError } from "../model/domain/errors.js";

const eservicesRouter = zodiosRouter(api.api);

function runWithDb<A>(
  program: Effect.Effect<DB, CatalogProcessError, A>,
  res: Response,
  successStatusCode: number
): Promise<void> {
  return Effect.runPromise(
    pipe(
      program,
      Effect.provideService(DB, db),
      Effect.catchAllDefect(() =>
        Effect.sync(() => {
          const errorRes = makeGenericErrorProblem();
          res.status(errorRes.status).json(errorRes).end();
        })
      ),
      Effect.match(
        (error) => {
          const errorRes = mapCatalogServiceErrorToApiError(error);
          res.status(errorRes.status).json(errorRes).end();
        },
        () => {
          res.status(successStatusCode).send();
        }
      )
    )
  );
}

eservicesRouter
  .post("/eservices", async (req, res) =>
    runWithDb(catalogService.createEService(req.body, req.authData), res, 201)
  )
  .put("/eservices/:eServiceId", async (req, res) =>
    runWithDb(
      catalogService.updateEService(req.params.eServiceId, req.body),
      res,
      200
    )
  )
  .delete("/eservices/:eServiceId", async (req, res) =>
    runWithDb(catalogService.deleteEService(req.params.eServiceId), res, 204)
  );

export default eservicesRouter;
