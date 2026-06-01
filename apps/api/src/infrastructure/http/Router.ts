import http from "node:http";

export type RouteHandler = (
  req: http.IncomingMessage & { params: Record<string, string>; body: unknown },
  res: http.ServerResponse,
) => void | Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private readonly routes: Route[] = [];

  private register(method: string, path: string, handler: RouteHandler): void {
    const paramNames: string[] = [];
    const regexStr = path
      .replace(/:[^/]+/g, (match) => {
        paramNames.push(match.slice(1));
        return "([^/]+)";
      })
      .replaceAll("*", String.raw`\*`)
      .replaceAll(".", String.raw`\.`);

    this.routes.push({
      method: method.toUpperCase(),
      pattern: new RegExp(`^${regexStr}$`),
      paramNames,
      handler,
    });
  }

  get(path: string, handler: RouteHandler): void {
    this.register("GET", path, handler);
  }
  post(path: string, handler: RouteHandler): void {
    this.register("POST", path, handler);
  }
  put(path: string, handler: RouteHandler): void {
    this.register("PUT", path, handler);
  }
  delete(path: string, handler: RouteHandler): void {
    this.register("DELETE", path, handler);
  }

  private parseBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        if (!raw) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({});
        }
      });
      req.on("error", reject);
    });
  }

  async dispatch(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url?.split("?")[0] ?? "/";
    const method = req.method?.toUpperCase() ?? "GET";

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = new RegExp(route.pattern).exec(url);
      if (!match) continue;

      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });

      const body = await this.parseBody(req);

      const augmentedReq = Object.assign(req, { params, body });

      try {
        await route.handler(augmentedReq, res);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Internal server error";
        console.error("[Router] Handler error:", message);
        if (!res.writableEnded) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: message }));
        }
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `No route matched: ${method} ${url}` }));
  }
}

export function json(
  res: http.ServerResponse,
  status: number,
  data: unknown,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function getQueryParam(
  req: http.IncomingMessage,
  key: string,
): string | undefined {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.searchParams.get(key) ?? undefined;
}
