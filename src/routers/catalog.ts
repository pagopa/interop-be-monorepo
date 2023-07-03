import * as Effect from "@effect/io/Effect";
import { pipe } from "@effect/data/Function";
import { WithZodiosContext } from "@zodios/express";
import { Request, Response } from "express";
import { api } from "../model/generated/api.js";
import {
  makeGenericErrorProblem,
  mapCatalogServiceErrorToApiError,
} from "../model/types.js";
import { catalogService } from "../services/CatalogService.js";
import { db, DB } from "../repositories/db.js";
import { CatalogProcessError } from "../model/domain/errors.js";
import { AuthData } from "../auth/authData.js";
import { AuthDataCtx, DBCtx } from "../effectCtx.js";
import { ExpressContext, ctx } from "../app.js";

const eservicesRouter = ctx.router(api.api);

function runPromise<A>(
  program: Effect.Effect<DB | AuthData, CatalogProcessError, A>,
  req: WithZodiosContext<Request, ExpressContext>,
  res: Response,
  successStatusCode: number
): Promise<void> {
  return Effect.runPromise(
    pipe(
      program,
      Effect.provideService(AuthDataCtx, req.authData),
      Effect.provideService(DBCtx, db),
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
    runPromise(catalogService.createEService(req.body), req, res, 201)
  )
  .put("/eservices/:eServiceId", async (req, res) =>
    runPromise(
      catalogService.updateEService(req.params.eServiceId, req.body),
      req,
      res,
      200
    )
  )
  .delete("/eservices/:eServiceId", async (req, res) =>
    runPromise(
      catalogService.deleteEService(req.params.eServiceId),
      req,
      res,
      204
    )
  );

export default eservicesRouter;
