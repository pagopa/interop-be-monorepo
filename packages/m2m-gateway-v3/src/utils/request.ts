import { Request } from "express";

export const extractRequestDetails = (
  req: Request,
  m2mGatewayPublicUrl: string
): { method: string; url: string } => {
  const method = req.method.toUpperCase();
  const path = req.path;
  const url = `${m2mGatewayPublicUrl}${path}`;
  return { method, url };
};
