import type { z } from "zod";

export type Branded<T, Brand extends string> = T & {
  readonly [B in Brand]: Brand;
};

export function branded<B extends string, T>(
  _brand: B,
  schema: z.Schema<T>
): z.Schema<Branded<T, B>> {
  return schema as any;
}

export function brand<Brand extends string>(
  _: Brand
): <T>(t: T) => Branded<T, Brand> {
  return (t) => t as any;
}
