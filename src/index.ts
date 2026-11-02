export interface Env {
  DB: D1Database;
  APP_ENV?: string;
}

type JsonRecord = Record<string, unknown>;

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const id = (): string => crypto.randomUUID();

async function readJson(request: Request): Promise<JsonRecord | null> {
  try {
    const value: unknown = await request.json();
    if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
    return null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,authorization" } });
    }

    try {
      if (url.pathname === "/api/health" && method === "GET") {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return json({ ok: result?.ok === 1, service: "wgi-ai-virtual-office-api", database: "cloudflare-d1", environment: env.APP_ENV ?? "unknown" });
      }

      // These endpoints are intentionally not production-ready for public deployment.
      // Add verified authentication and organization-level authorization before exposing business data.
      if (url.pathname === "/api/agents" && method === "GET") {
        const organizationId = url.searchParams.get("organizationId");
        if (!organizationId) return json({ error: "organizationId is required" }, 400);
        const { results } = await env.DB.prepare(
          "SELECT id, agent_key, name, department, description, status, created_at, updated_at FROM agents WHERE organization_id = ? ORDER BY department, name"
        ).bind(organizationId).all();
        return json({ data: results });
      }

      if (url.pathname === "/api/agents" && method === "POST") {
        const body = await readJson(request);
        if (!body || typeof body.organizationId !== "string" || typeof body.agentKey !== "string" || typeof body.name !== "string" || typeof body.department !== "string") {
          return json({ error: "organizationId, agentKey, name and department are required" }, 400);
        }
        const agentId = id();
        await env.DB.prepare(
          "INSERT INTO agents (id, organization_id, agent_key, name, department, description, status) VALUES (?, ?, ?, ?, ?, ?, 'idle')"
        ).bind(agentId, body.organizationId, body.agentKey, body.name, body.department, typeof body.description === "string" ? body.description : "").run();
        const agent = await env.DB.prepare(
          "SELECT id, agent_key, name, department, description, status, created_at, updated_at FROM agents WHERE id = ?"
        ).bind(agentId).first();
        return json({ data: agent }, 201);
      }

      if (url.pathname === "/api/tasks" && method === "GET") {
        const organizationId = url.searchParams.get("organizationId");
        if (!organizationId) return json({ error: "organizationId is required" }, 400);
        const { results } = await env.DB.prepare(
          "SELECT id, title, prompt, status, priority, assigned_agent_id, created_at, updated_at FROM tasks WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100"
        ).bind(organizationId).all();
        return json({ data: results });
      }

      if (url.pathname === "/api/tasks" && method === "POST") {
        const body = await readJson(request);
        if (!body || typeof body.organizationId !== "string" || typeof body.title !== "string" || typeof body.prompt !== "string") {
          return json({ error: "organizationId, title and prompt are required" }, 400);
        }
        const taskId = id();
        const priority = ["low", "normal", "high", "urgent"].includes(String(body.priority)) ? String(body.priority) : "normal";
        await env.DB.prepare(
          "INSERT INTO tasks (id, organization_id, title, prompt, priority, assigned_agent_id, status) VALUES (?, ?, ?, ?, ?, ?, 'queued')"
        ).bind(taskId, body.organizationId, body.title, body.prompt, priority, typeof body.assignedAgentId === "string" ? body.assignedAgentId : null).run();
        const task = await env.DB.prepare(
          "SELECT id, title, prompt, status, priority, assigned_agent_id, created_at, updated_at FROM tasks WHERE id = ?"
        ).bind(taskId).first();
        return json({ data: task }, 201);
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      console.error("API request failed", error);
      return json({ error: "Internal server error" }, 500);
    }
  },
};
