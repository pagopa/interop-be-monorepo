import { SafeParseError, ZodError } from "zod";

export const getMockParsingError = <T>(
  invalidValue: string,
  path: string,
  errMsg: string
): SafeParseError<T> => ({
  success: false,
  error: new ZodError([
    {
      received: invalidValue,
      code: "invalid_enum_value",
      options: ["admin", "security", "api", "support"],
      path: [path, 1],
      message: errMsg,
    },
  ]),
});
