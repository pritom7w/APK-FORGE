# Technical decisions

1. Netlify remains static frontend hosting. Android compilation runs in GitHub Actions.
2. Cloudflare Worker is the API coordinator.
3. R2 stores source ZIPs, job JSON, and generated APKs. This avoids requiring D1 in the first prototype.
4. GitHub Actions is split into fetch, build, and publish jobs so Cloudflare/R2 secrets are not intentionally exposed to the job executing uploaded Gradle scripts.
5. Initial framework support is native Android Gradle only. Flutter, NDK, React Native, signing, and multi-user support are deferred.
6. Status uses polling. SSE is not implemented.
