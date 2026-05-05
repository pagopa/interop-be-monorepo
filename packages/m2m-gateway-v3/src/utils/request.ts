import { Request } from "express";

export const extractRequestDetailsForDPoPCheck = (
  req: Request,
  dpopHtuBase: string
): { expectedHtm: string; expectedHtu: string } => {
  const expectedHtm = req.method.toUpperCase();
  const path = req.path;
  const expectedHtu = `${dpopHtuBase}${path}`;
  return { expectedHtm, expectedHtu };
};
