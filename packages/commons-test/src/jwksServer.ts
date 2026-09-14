// test/jwks-server.ts
import { createServer, Server } from "http";
import { JWK } from "jose";
import { AddressInfo } from "net";

export interface JwksServer {
  url: string;
  requestCount(): number;
  close(): Promise<void>;
}

export async function startJwksServer(
  publicJwk: JWK,
  { failuresBeforeSuccess = 0 }: { failuresBeforeSuccess?: number } = {}
): Promise<JwksServer> {
  let requests = 0;
  const server: Server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/.well-known/jwks.json") {
      // eslint-disable-next-line functional/immutable-data
      requests += 1;

      if (requests <= failuresBeforeSuccess) {
        // eslint-disable-next-line functional/immutable-data
        res.statusCode = 503;
        res.end();
        return;
      }

      const body = JSON.stringify({ keys: [publicJwk] });

      // eslint-disable-next-line functional/immutable-data
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(body);
      return;
    }

    // eslint-disable-next-line functional/immutable-data
    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));

  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/.well-known/jwks.json`,
    requestCount: () => requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      ),
  };
}
