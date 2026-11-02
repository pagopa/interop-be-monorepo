import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { contactDataApi } from "pagopa-interop-api-clients";
import {
  authRole,
  ExpressContext,
  fromAppContext,
  validateAuthorization,
  ZodiosContext,
} from "pagopa-interop-commons";
import { ApiError, emptyErrorMapper } from "pagopa-interop-models";

import { contactCreationFailed, makeApiProblem } from "../model/errors.js";
import { ContactService } from "../services/contactService.js";
import { contactValidationErrorToApiProblem } from "../utilities/errorHandlers.js";

export const contactRouter = (
  ctx: ZodiosContext,
  service: ContactService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> =>
  ctx
    .router(contactDataApi.contactApi.api, {
      validationErrorHandler: contactValidationErrorToApiProblem,
    })
    .post("/contacts", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [authRole.INTERNAL_ROLE]);
        const contact = await service.createContact(req.body, ctx);
        return res.status(201).send(contactDataApi.Contact.parse(contact));
      } catch (error) {
        const problem = makeApiProblem(
          error instanceof ApiError ? error : contactCreationFailed(),
          emptyErrorMapper,
          ctx
        );
        return res.status(problem.status).send(problem);
      }
    });
