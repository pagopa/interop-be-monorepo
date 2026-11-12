import "./mockHttpMiddleware.js";
import { createApp } from "../src/app.js";
import { AuthorizationService } from "../src/services/authorizationService.js";

export const authorizationService = {} as AuthorizationService;

export const api = await createApp(authorizationService);
