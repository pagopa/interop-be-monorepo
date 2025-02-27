// import { contextMiddleware, loggerMiddleware } from "pagopa-interop-commons";
import express from "express";
import fastify from "fastify";
import fastifyExpress from "@fastify/express";
// import healthRouter from "./routers/HealthRouter.js";
import authorizationServerRouter from "./routers/AuthorizationServerRouter.js";

// const serviceName = "authorization-server";

const app = fastify();
await app.register(fastifyExpress);

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.express.disabled("x-powered-by");

// app.use(healthRouter);
// app.use(contextMiddleware(serviceName, false));
app.use(express.urlencoded({ extended: true }));
// app.use(loggerMiddleware(serviceName));
app.use(authorizationServerRouter());

export default app;
