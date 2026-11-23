# API contract

Base URL: deployed Cloudflare Worker URL. Browser endpoints use `Authorization: Bearer <API_TOKEN>` except `GET /health`.

- `GET /health`: public health check.
- `POST /build`: authenticated multipart form. Fields: `project` (ZIP file), `config` (JSON). Accepted `projectType`: `auto` or `android`; `variant`: `debug` or `release` is recorded but the current workflow always builds debug. Returns HTTP 202 `{ "jobId": "UUID", "status": "queued" }`.
- `GET /build/{jobId}`: authenticated status JSON with `status`, `progress`, `stage`, `logs`, `error`, and `downloadUrl`.
- `GET /build/{jobId}/events`: returns HTTP 501. Frontend should fall back to polling.
- `GET /download/{jobId}`: authenticated APK stream.

Internal endpoints require `Authorization: Bearer <CALLBACK_SECRET>` and must never be called from browser code:
- `GET /internal/jobs/{jobId}/source`
- `POST /internal/jobs/{jobId}/status`

Current states: `queued`, `validating`, `building`, `uploading_artifact`, `completed`, `failed`.
