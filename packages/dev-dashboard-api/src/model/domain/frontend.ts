import { FrontendStatus } from "pagopa-interop-dev-dashboard-contracts";
import { z } from "zod";

import { FRONTEND_AGENT_LIMITS } from "../../config/constants.js";

const FrontendIdentitySelection = z
  .object({ tenantKey: z.string(), userKey: z.string() })
  .strict();

export type FrontendIdentitySelection = z.infer<
  typeof FrontendIdentitySelection
>;

export const FrontendAgentStatus = FrontendStatus.extend({
  identity: FrontendIdentitySelection.optional(),
});

export type FrontendAgentStatus = z.infer<typeof FrontendAgentStatus>;

export const FrontendAgentError = z.object({
  error: z.string().max(FRONTEND_AGENT_LIMITS.errorLength),
});

export type FrontendLocalStartCommand = {
  type: "start";
  mode: "local";
  sessionToken: string;
  identity: FrontendIdentitySelection;
};

export type FrontendAgentCommand =
  | { type: "install" | "stop" | "smoke" | "browser" }
  | { type: "start"; mode: "dev" }
  | FrontendLocalStartCommand;

export type FrontendProgress = Pick<
  FrontendStatus,
  "state" | "phases" | "operationId" | "error"
>;
