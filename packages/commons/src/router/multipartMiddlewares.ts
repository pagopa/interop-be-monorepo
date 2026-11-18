import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { RequestHandler } from "express";
import multer from "multer";
import { badRequestError } from "pagopa-interop-models";

import { ExpressContext } from "../context/context.js";

const parseMultipartBody = multer({
  storage: multer.memoryStorage(),
}).any();

// If form-data is used, the files are stored in memory and inserted in the body to make zodios work
// Please notice this replaces all data in req.body
export const multerMiddleware: RequestHandler = (req, res, next) =>
  parseMultipartBody(req, res, (error?: unknown) =>
    error
      ? next(
          badRequestError(
            "Invalid multipart/form-data request",
            error instanceof Error ? [error] : undefined
          )
        )
      : next()
  );

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
