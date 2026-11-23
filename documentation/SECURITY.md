# Security notes

This is a single-owner prototype. Anyone with the API bearer token can submit builds and access job metadata and APKs. Restrict site access and keep the token private. Never commit API tokens, GitHub tokens, callback secrets, R2 credentials, keystores, or passwords.

The workflow separates secret-bearing jobs from the job that executes uploaded Gradle scripts. Do not move R2 or callback secrets into the build job. The build job executes user-supplied build logic and must be treated as untrusted. Build only projects you own or are authorized to build.

The ZIP extractor rejects traversal paths, symlinks, excessive entry counts, large uncompressed archives, and extreme compression ratios. The Worker enforces a 50 MB upload limit. This does not eliminate every archive or compiler attack. For a public multi-user service, use stronger isolation, identity-based authorization, quotas, rate limits, durable job storage, cleanup, monitoring, and security review.
