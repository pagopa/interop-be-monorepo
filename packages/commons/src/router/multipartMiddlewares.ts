import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import multer from "multer";
import { RequestHandler } from "express";
import { ExpressContext } from "../context/context.js";

// If form-data is used, the files are stored in memory and inserted in the body to make zodios work
// Please notice this replaces all data in req.body
export const multerMiddleware: RequestHandler = multer({
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
