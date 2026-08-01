import type { SxcuConfig } from "@albbas/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticateRequest, extractApiKey } from "../auth.js";
import { env } from "../env.js";
import { baseUrlForUser } from "../lib/domain.js";

async function buildSxcu(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const rawKey = extractApiKey(request);
  if (!rawKey) {
    return reply
      .code(401)
      .type("text/plain")
      .send("Missing API key (X-Api-Key header)");
  }

  const auth = await authenticateRequest(request);
  if (!auth) {
    return reply.code(401).type("text/plain").send("Invalid API key");
  }

  const baseUrl = baseUrlForUser(auth.user);
  if (!baseUrl) {
    return reply
      .code(400)
      .type("text/plain")
      .send("Set a domain and subdomain in settings first");
  }

  const config: SxcuConfig = {
    Name: "albbas",
    DestinationType: "ImageUploader, TextUploader, FileUploader",
    RequestMethod: "POST",
    RequestURL: `${env.APP_URL}/api/upload`,
    Body: "MultipartFormData",
    FileFormName: "file",
    Headers: { "X-Api-Key": rawKey },
    URL: "{response:url}",
    DeletionURL: "{response:deleteUrl}",
    ErrorMessage: "{response:error}",
  };

  return reply
    .type("application/json")
    .header("content-disposition", 'attachment; filename="albbas.sxcu"')
    .send(JSON.stringify(config, null, 2));
}

export function registerSxcuRoutes(app: FastifyInstance): void {
  app.get("/api/uploaders/sharex.sxcu", buildSxcu);
}
