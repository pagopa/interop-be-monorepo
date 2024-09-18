import { zodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import handleResponse from "../utilities/handleResponse.js";

const healthRouter = zodiosRouter(bffApi.healthApi.api);

healthRouter.get("/status", async (_, res) => handleResponse(res, 200));

export default healthRouter;
