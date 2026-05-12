import {
  HandlerCommonParams as CommonsHandlerCommonParams,
  HandlerParams as CommonsHandlerParams,
} from "pagopa-interop-notification-commons";
import { z } from "zod";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";

export type HandlerCommonParams =
  CommonsHandlerCommonParams<ReadModelServiceSQL>;

export type HandlerParams<T extends z.ZodType> = CommonsHandlerParams<
  T,
  ReadModelServiceSQL
>;
