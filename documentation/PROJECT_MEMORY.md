# APK FORGE project memory

- Owner GitHub: `pritom7w`
- Repository: `https://github.com/pritom7w/APK-FORGE`
- Frontend: user reports an `index.html` is hosted on Netlify. The actual file was inspected in ChatGPT Library on 2026-11-24.
- Frontend API contract: `GET /health`, `POST /build` multipart fields `project` and `config`, `GET /build/{id}`, `GET /build/{id}/events`, `GET /download/{id}`.
- Backend package in this starter: Cloudflare Worker + R2 job/source/artifact storage + GitHub Actions workflow.
- Implemented in files: single-owner bearer-token API, R2 source/job storage, GitHub workflow dispatch, private source retrieval, status callback, authenticated APK download, safe ZIP extraction script, native Gradle project root detection.
- Supported build path: native Android Gradle with `gradlew`, debug APK only.
- Not verified: deployment, repository commit, R2 setup, GitHub secrets, real APK build, frontend integration, end-to-end download.
- Known frontend changes needed: recognize `completed`, resolve relative `downloadUrl` against Worker base URL, do not persist API token in localStorage.
- Next: upload package contents to GitHub repo, configure R2 and Worker secrets, deploy Worker, configure GitHub Actions secrets, patch Netlify frontend, test with a trusted Gradle project.
