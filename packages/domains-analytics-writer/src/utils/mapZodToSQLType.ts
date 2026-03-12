/* eslint-disable no-underscore-dangle */
import {
  ZodTypeAny,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodEffects,
  ZodNumber,
  ZodBigInt,
  ZodString,
  ZodBoolean,
  ZodDate,
} from "zod";
import { match } from "ts-pattern";

/**
 * Recursively unwraps Zod wrappers (optional, nullable, default, effects)
 * to reveal the underlying core schema type.
 *
 * @param zodType - The Zod type to unwrap.
 * @returns The unwrapped core Zod type.
 */
function unwrap(zodType: ZodTypeAny): ZodTypeAny {
  if (
    zodType instanceof ZodOptional ||
    zodType instanceof ZodNullable ||
    zodType instanceof ZodDefault
  ) {
    return unwrap(zodType._def.innerType);
  }

  if (zodType instanceof ZodEffects) {
    return unwrap(zodType._def.schema);
  }

  return zodType;
}

/**
 * Maps a Zod schema type to an appropriate SQL column type.
 *
 * @param zodType - The Zod type to map.
 * @returns A string representing the SQL column type.
 */
export function mapZodToSQLType(zodType: ZodTypeAny): string {
  const unwrapped = unwrap(zodType);

  return match(unwrapped)
    .when(
      (t: ZodTypeAny): t is ZodNumber => t instanceof ZodNumber,
      () => "INTEGER"
    )
    .when(
      (t: ZodTypeAny): t is ZodBigInt => t instanceof ZodBigInt,
      () => "BIGINT"
    )
    .when(
      (t: ZodTypeAny): t is ZodString => t instanceof ZodString,
      () => "VARCHAR(255)"
    )
    .when(
      (t: ZodTypeAny): t is ZodBoolean => t instanceof ZodBoolean,
      () => "BOOLEAN"
    )
    .when(
      (t: ZodTypeAny): t is ZodDate => t instanceof ZodDate,
      () => "TIMESTAMP"
    )
    .otherwise(() => "VARCHAR(255)");
}
