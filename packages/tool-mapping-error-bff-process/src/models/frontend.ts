import { z } from "zod";

const FrontendServiceFile = z.object({
  file: z.string(),
  functionName: z.string(),
});

export type FrontendServiceFile = z.infer<typeof FrontendServiceFile>;

const FrontendStackCall = z.object({
  fileName: z.string(),
  lineNumber: z.number().int(),
});

type FrontendStackCall = z.infer<typeof FrontendStackCall>;

export const FrontendServiceFileWithStackCalls = z.object({
  fileName: z.string(),
  functionName: z.string(),
  stackCalls: z.array(FrontendStackCall),
});

export type FrontendServiceFileWithStackCalls = z.infer<
  typeof FrontendServiceFileWithStackCalls
>;
