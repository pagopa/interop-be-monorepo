import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import { CorrelationId, EventEnvelope } from "pagopa-interop-models";
import { z } from "zod";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../services/userServiceSQL.js";

export type HandlerCommonParams = {
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  templateService: HtmlTemplateService;
  userService: UserServiceSQL;
  correlationId: CorrelationId;
};

export type HandlerParams<T extends z.ZodType> = HandlerCommonParams & {
  decodedMessage: EventEnvelope<z.infer<T>>;
};
