import { zodiosApp, zodiosRouter } from "@zodios/express";
import { api } from "../model/generated/api.ts";

const app = zodiosApp();

const catalogRouter = zodiosRouter(api.api);

catalogRouter.get("/status", async (_, res) => res.status(200).end());

app.use(catalogRouter);

export default app;
