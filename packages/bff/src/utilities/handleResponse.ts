import { Response } from "express";
import { ZodType } from "zod";

export default function handleResponse<
  T,
  R extends Response<never, Record<string, unknown>>
>(res: R, status: number, response?: T, type?: ZodType): R {
  // eslint-disable-next-line custom/no-res-method
  return response !== undefined && type
    ? res.status(status).json(type.parse(response))
    : res.status(status).end();
}
