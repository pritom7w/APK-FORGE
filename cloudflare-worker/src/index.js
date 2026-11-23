const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function cors(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map(x => x.trim()).filter(Boolean);
  const originAllowed = !origin || allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": originAllowed ? (origin || allowed[0] || "*") : "null",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function auth(request, secret) {
  const h = request.headers.get("Authorization") || "";
  return !!secret && h === `Bearer ${secret}`;
}
function internalAuth(request, env) {
  return auth(request, env.CALLBACK_SECRET);
}
async function getJob(env, jobId) {
  const obj = await env.BUCKET.get(`jobs/${jobId}.json`);
  if (!obj) return null;
  try { return await obj.json(); } catch { return null; }
}
async function putJob(env, job) {
  job.updatedAt = now();
  await env.BUCKET.put(`jobs/${job.id}.json`, JSON.stringify(job), { httpMetadata: { contentType: "application/json" } });
}
function validId(s) { return /^[0-9a-f-]{36}$/i.test(s || ""); }

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const respond = (body, status = 200, extra = {}) => json(body, status, { ...headers, ...extra });

    if (path === "/health" && request.method === "GET") {
      return respond({ ok: true, service: "APK FORGE API", time: now(), storageConfigured: !!env.BUCKET });
    }
    if (!env.BUCKET) return respond({ error: "R2 bucket binding BUCKET is missing." }, 503);

    if (path === "/build" && request.method === "POST") {
      if (!auth(request, env.API_TOKEN)) return respond({ error: "Unauthorized" }, 401);
      const length = Number(request.headers.get("Content-Length") || 0);
      if (length > 50 * 1024 * 1024) return respond({ error: "ZIP exceeds the 50 MB upload limit." }, 413);
      let form;
      try { form = await request.formData(); } catch { return respond({ error: "Expected multipart/form-data." }, 400); }
      const file = form.get("project");
      if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".zip")) return respond({ error: "A ZIP file is required in field 'project'." }, 400);
      if (file.size < 22 || file.size > 50 * 1024 * 1024) return respond({ error: "ZIP must be between 22 bytes and 50 MB." }, 413);
      let config = {};
      try { config = JSON.parse(String(form.get("config") || "{}")); } catch { return respond({ error: "Field 'config' must be valid JSON." }, 400); }
      const projectType = String(config.projectType || "auto");
      if (config.launchPassword) return respond({ error: "The optional app launch password feature is not implemented. Leave that field empty." }, 422);
      if (String(config.variant || "debug") === "release") return respond({ error: "Release builds are not enabled in this starter. Select Debug APK." }, 422);
      if (!["auto", "android"].includes(projectType)) return respond({ error: "This starter currently supports native Android Gradle projects only. Flutter and NDK build support is not implemented yet." }, 422);
      const jobId = id();
      const job = { id: jobId, status: "queued", progress: 1, stage: "Queued", logs: ["Build request accepted."], config: { variant: config.variant === "release" ? "release" : "debug", compileSdk: Number(config.compileSdk || 35), targetSdk: Number(config.targetSdk || config.compileSdk || 35), minSdk: Number(config.minSdk || 26), projectType }, sourceKey: `sources/${jobId}.zip`, artifactKey: null, error: null, createdAt: now(), updatedAt: now() };
      await env.BUCKET.put(job.sourceKey, await file.arrayBuffer(), { httpMetadata: { contentType: "application/zip" } });
      await putJob(env, job);
      try {
        const owner = env.GH_OWNER, repo = env.GH_REPO, workflow = env.GH_WORKFLOW_FILE || "android-build.yml";
        if (!owner || !repo || !env.GITHUB_TOKEN) throw new Error("GitHub dispatch configuration is incomplete.");
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
          method: "POST", headers: { "Authorization": `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "apk-forge-worker", "Content-Type": "application/json" },
          body: JSON.stringify({ ref: env.GH_BRANCH || "main", inputs: { job_id: jobId } })
        });
        if (!response.ok) throw new Error(`GitHub workflow dispatch failed with HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
        job.status = "queued"; job.logs.push("GitHub Actions workflow dispatched."); await putJob(env, job);
        return respond({ jobId, status: job.status }, 202);
      } catch (e) {
        job.status = "failed"; job.stage = "Dispatch failed"; job.error = e.message; job.logs.push(e.message); await putJob(env, job);
        return respond({ error: "Could not start the GitHub build workflow.", details: e.message, jobId }, 502);
      }
    }

    const internalSource = path.match(/^\/internal\/jobs\/([0-9a-f-]{36})\/source$/i);
    if (internalSource && request.method === "GET") {
      if (!internalAuth(request, env)) return respond({ error: "Unauthorized" }, 401);
      const job = await getJob(env, internalSource[1]);
      if (!job) return respond({ error: "Job not found" }, 404);
      const obj = await env.BUCKET.get(job.sourceKey);
      if (!obj) return respond({ error: "Source archive expired or missing" }, 404);
      return new Response(obj.body, { headers: { ...headers, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${job.id}.zip"`, "Cache-Control": "no-store" } });
    }

    // GitHub Actions sends the finished APK directly to this authenticated endpoint.
    // This keeps R2 S3 credentials out of GitHub Actions and avoids a second R2 API key.
    const artifactUpload = path.match(/^\/internal\/jobs\/([0-9a-f-]{36})\/artifact$/i);
    if (artifactUpload && request.method === "PUT") {
      if (!internalAuth(request, env)) return respond({ error: "Unauthorized" }, 401);
      const job = await getJob(env, artifactUpload[1]);
      if (!job) return respond({ error: "Job not found" }, 404);
      const length = Number(request.headers.get("Content-Length") || 0);
      if (length > 90 * 1024 * 1024) return respond({ error: "APK exceeds the 90 MB upload limit." }, 413);
      const contentType = request.headers.get("Content-Type") || "";
      if (!contentType.includes("application/vnd.android.package-archive") && !contentType.includes("application/octet-stream")) {
        return respond({ error: "APK upload must use the Android APK or binary content type." }, 415);
      }
      if (!request.body) return respond({ error: "APK request body is empty." }, 400);
      const artifactKey = `artifacts/${job.id}.apk`;
      await env.BUCKET.put(artifactKey, request.body, { httpMetadata: { contentType: "application/vnd.android.package-archive" } });
      job.artifactKey = artifactKey;
      job.status = "completed";
      job.progress = 100;
      job.stage = "APK ready";
      job.error = null;
      job.logs = [...(job.logs || []), "APK uploaded to private Cloudflare R2 storage."];
      await putJob(env, job);
      return respond({ ok: true, status: "completed", artifactKey });
    }

    const callback = path.match(/^\/internal\/jobs\/([0-9a-f-]{36})\/status$/i);
    if (callback && request.method === "POST") {
      if (!internalAuth(request, env)) return respond({ error: "Unauthorized" }, 401);
      const job = await getJob(env, callback[1]);
      if (!job) return respond({ error: "Job not found" }, 404);
      let update; try { update = await request.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
      const allowed = ["queued", "validating", "building", "uploading_artifact", "completed", "failed"];
      if (update.status && !allowed.includes(update.status)) return respond({ error: "Invalid status" }, 400);
      if (update.status) job.status = update.status;
      if (Number.isFinite(Number(update.progress))) job.progress = Math.max(0, Math.min(100, Number(update.progress)));
      if (typeof update.stage === "string") job.stage = update.stage.slice(0, 160);
      if (typeof update.error === "string") job.error = update.error.slice(0, 4000);
      if (typeof update.artifactKey === "string" && /^artifacts\/[0-9a-f-]{36}\.apk$/i.test(update.artifactKey)) job.artifactKey = update.artifactKey;
      if (Array.isArray(update.logs)) job.logs = update.logs.slice(-120).map(x => String(x).slice(0, 2000));
      await putJob(env, job);
      return respond({ ok: true });
    }

    const jobRoute = path.match(/^\/build\/([0-9a-f-]{36})$/i);
    if (jobRoute && request.method === "GET") {
      if (!auth(request, env.API_TOKEN)) return respond({ error: "Unauthorized" }, 401);
      const job = await getJob(env, jobRoute[1]);
      if (!job) return respond({ error: "Job not found" }, 404);
      return respond({ jobId: job.id, status: job.status, progress: job.progress, percent: job.progress, stage: job.stage, logs: job.logs, error: job.error, downloadUrl: job.status === "completed" && job.artifactKey ? `/download/${job.id}` : null, updatedAt: job.updatedAt });
    }

    const eventsRoute = path.match(/^\/build\/([0-9a-f-]{36})\/events$/i);
    if (eventsRoute && request.method === "GET") return respond({ error: "SSE is not enabled in this starter. Use status polling." }, 501);

    const downloadRoute = path.match(/^\/download\/([0-9a-f-]{36})$/i);
    if (downloadRoute && request.method === "GET") {
      if (!auth(request, env.API_TOKEN)) return respond({ error: "Unauthorized" }, 401);
      const job = await getJob(env, downloadRoute[1]);
      if (!job || job.status !== "completed" || !job.artifactKey) return respond({ error: "APK is not available." }, 404);
      const obj = await env.BUCKET.get(job.artifactKey);
      if (!obj) return respond({ error: "APK artifact is missing." }, 404);
      return new Response(obj.body, { headers: { ...headers, "Content-Type": "application/vnd.android.package-archive", "Content-Disposition": `attachment; filename="APK-FORGE-${job.id}.apk"`, "Cache-Control": "private, no-store" } });
    }
    return respond({ error: "Not found" }, 404);
  }
};
