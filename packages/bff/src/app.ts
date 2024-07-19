import multer from "multer";
import {
  authenticationMiddleware,
  contextMiddleware,
  initFileManager,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { getInteropBeClients } from "./providers/clientProvider.js";
import healthRouter from "./routers/HealthRouter.js";
import agreementRouter from "./routers/agreementRouter.js";
import attributeRouter from "./routers/attributeRouter.js";
import catalogRouter from "./routers/catalogRouter.js";
import genericRouter from "./routers/genericRouter.js";
import purposeRouter from "./routers/purposeRouter.js";
import selfcareRouter from "./routers/selfcareRouter.js";
import tenantRouter from "./routers/tenantRouter.js";

const serviceName = "bff-process";
const fileManager = initFileManager(config);

const clients = getInteropBeClients();

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

// If form-data is used, the files are stored in memory and inserted in the body to make zodios work
// Please notice this replace all data in req.body
app.use(multer({ storage: multer.memoryStorage() }).any());
app.use(function (req, _res, next) {
  if (Array.isArray(req.files)) {
    req.files.forEach((file) => {
      // eslint-disable-next-line functional/immutable-data
      req.body[file.fieldname] = new File([file.buffer], file.originalname, {
        type: file.mimetype,
      });
    });
  }

  next();
});

app.use(contextMiddleware(serviceName, true));
app.use(healthRouter);
app.use(authenticationMiddleware);
app.use(loggerMiddleware(serviceName));
app.use(genericRouter(zodiosCtx));
app.use(catalogRouter(zodiosCtx, clients, fileManager));
app.use(attributeRouter(zodiosCtx));
app.use(purposeRouter(zodiosCtx, clients));
app.use(agreementRouter(zodiosCtx));
app.use(selfcareRouter(zodiosCtx));
app.use(tenantRouter(zodiosCtx));

export default app;
