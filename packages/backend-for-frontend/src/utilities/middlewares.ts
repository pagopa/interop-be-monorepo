import { constants } from "http2";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import multer from "multer";
import {
  ExpressContext,
  fromAppContext,
  isUiAuthData,
} from "pagopa-interop-commons";
import {
  makeApiProblemBuilder,
  unauthorizedError,
} from "pagopa-interop-models";

// If form-data is used, the files are stored in memory and inserted in the body to make zodios work
// Please notice this replaces all data in req.body
export const multerMiddleware = multer({
  storage: multer.memoryStorage(),
}).any();

export const fromFilesToBodyMiddleware: ZodiosRouterContextRequestHandler<
  ExpressContext
> = (req, _res, next) => {
  if (Array.isArray(req.files)) {
    req.files.forEach((file) => {
      // eslint-disable-next-line functional/immutable-data
      req.body[file.fieldname] = new File([file.buffer], file.originalname, {
        type: file.mimetype,
      });
    });
  }

  next();
};

const makeApiProblem = makeApiProblemBuilder({});
export function uiAuthDataValidationMiddleware(): ZodiosRouterContextRequestHandler<ExpressContext> {
  return async (req, res, next) => {
    // We assume that:
    // - contextMiddleware already set basic ctx info such as correlationId
    // - authenticationMiddleware already set authData in ctx

    const ctx = fromAppContext(req.ctx);

    if (!isUiAuthData(ctx.authData)) {
      const errorRes = makeApiProblem(
        unauthorizedError(
          `Invalid role ${ctx.authData.systemRole} for this operation`
        ),
        () => constants.HTTP_STATUS_FORBIDDEN,
        ctx
      );
      return res.status(errorRes.status).send(errorRes);
    }

    return next();
  };
}
