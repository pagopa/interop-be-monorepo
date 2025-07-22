import {
  ApplicationAuditBeginRequest,
  ApplicationAuditEndRequest,
  ApplicationAuditEndRequestSessionTokenExchange,
} from "pagopa-interop-models";
import { z } from "zod";

const EndRequestEvent = z.union([
  ApplicationAuditEndRequestSessionTokenExchange,
  ApplicationAuditEndRequest,
]);

export const ApplicationAuditEvent = z.union([
  ApplicationAuditBeginRequest,
  EndRequestEvent,
]);

export type ApplicationAuditEvent = z.infer<typeof ApplicationAuditEvent>;
