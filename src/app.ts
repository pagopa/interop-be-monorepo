import { zodiosApp } from "@zodios/express";
import healthRouter from "./routers/health.ts";
import eservicesRouter from "./routers/catalog.ts";

const app = zodiosApp();
app.use(healthRouter, eservicesRouter);

export default app;
