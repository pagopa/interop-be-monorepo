import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import { CorrelationId, EventEnvelope } from "pagopa-interop-models";
import { z } from "zod";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../services/userServiceSQL.js";

export type HandlerParams<T extends z.ZodType> = {
  decodedMessage: EventEnvelope<z.infer<T>>;
  correlationId: CorrelationId;
  logger: Logger;
  readModelService: ReadModelServiceSQL;
  templateService: HtmlTemplateService;
  userService: UserServiceSQL;
};
