import { ZodError } from "zod";

export function invalidLogCursors(): ZodError {
  return new ZodError([
    {
      code: "custom",
      path: ["cursors"],
      message: "Invalid cursors JSON",
    },
  ]);
}

export function unknownLogPreset(id: string): ZodError {
  return new ZodError([
    {
      code: "custom",
      path: ["source"],
      message: `Unknown preset: ${id}`,
    },
  ]);
}
