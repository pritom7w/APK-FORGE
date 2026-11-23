# APK FORGE: Android-only, one-ZIP deployment package

This package upgrades the existing APK FORGE starter while preserving its Netlify frontend design and GitHub repository architecture. It is designed so the repository owner can do the setup from an Android phone using GitHub's website. GitHub-hosted Actions runners install the development tools and deploy the backend. No PC, Codespaces, local terminal, Node.js installation, or Wrangler installation is needed.

## What this version automates

- Extracts this package from one ZIP uploaded to the GitHub repository.
- Commits the extracted backend and Android build workflow into the repository.
- Installs Node.js and the Worker npm dependencies on a GitHub-hosted runner.
- Creates the private Cloudflare R2 bucket if it is not already present.
- Deploys the Cloudflare Worker.
- Installs the three private Worker secrets.
- Checks the public Worker health endpoint.
- Sends completed APK files from GitHub Actions to the Worker, which stores them in private R2. No separate R2 S3 Access Key or Secret Access Key is needed in this version.

## What is not automated

You must create the Cloudflare API token, GitHub fine-grained token, and random application secrets once, then add them to GitHub repository settings. These credentials authorize the deployment and must not be placed inside the ZIP or website. You must also add the resulting Worker URL as a GitHub repository variable after the first deployment, and upload the supplied patched `frontend/index.html` to the existing Netlify site.

A first deployment can still fail because of a wrong token, wrong account ID, wrong Netlify origin, account restrictions, service limits, or a platform-side issue. The workflow stops at the failing step and shows the error. It cannot honestly guarantee zero failures before a real deployment test.

## Supported Android projects

- Native Android Gradle projects with a working Gradle wrapper (`gradlew`).
- Kotlin and Java Android app modules using Gradle.
- Debug APK only.
- One project per ZIP.
- Source ZIP upload limit: 50 MB.
- APK upload limit through the Worker: 90 MB.
- Build runs on GitHub-hosted Ubuntu runners with Java 17 and Android SDK 35.

Not implemented: Flutter, React Native, standalone NDK/C/C++, release APK signing, app launch password injection, user accounts, multi-user isolation, cancellation, automatic artifact retention, or Server-Sent Events. Use Debug APK and Auto detect or Android Gradle. Leave any old launch-password field empty. Build only projects you own or are authorized to build. Gradle build scripts execute code on the runner.

## Part 1: Prepare the ZIP on GitHub

1. Download `APK-FORGE-STARTER.zip`.
2. Open your repository: `https://github.com/pritom7w/APK-FORGE`.
3. Tap **Add file**, then **Upload files**.
4. Upload the ZIP to the repository's top level. The exact filename must be `APK-FORGE-STARTER.zip`.
5. Commit the upload to the `main` branch.

Do not unzip it on your phone. GitHub Actions will unzip it for you.

## Part 2: Add the one-time installer workflow

The file `APK-FORGE-INSTALLER.yml` is supplied separately with this package.

1. In the GitHub repository, open **Add file** and choose **Create new file**.
2. In the filename box, enter exactly: `.github/workflows/install-apk-forge.yml`
3. Open the supplied `APK-FORGE-INSTALLER.yml` file, copy all its text, and paste it into the GitHub editor.
4. Commit the new file to `main`.

This is the only workflow file you need to create manually. It will extract the ZIP and install the other workflow files automatically.

## Part 3: Create the Cloudflare API token

In Cloudflare Dashboard:

1. Open **My Profile** then **API Tokens**.
2. Choose **Create Token** and create a custom token.
3. Give it these account permissions:
   - **Account / Workers Scripts / Write**
   - **Account / Account Settings / Read**
   - **Account / Workers R2 Storage / Write**
4. Restrict the token to the Cloudflare account that will host APK FORGE.
5. Create the token and copy it. Cloudflare may show it only once.

Also copy the Cloudflare **Account ID** from the account overview or Workers & Pages overview.

## Part 4: Create a GitHub fine-grained token

In GitHub:

1. Open **Settings** for your GitHub account.
2. Open **Developer settings**, then **Personal access tokens**, then **Fine-grained tokens**.
3. Create a token with resource owner `pritom7w`.
4. Select **Only select repositories**, then select `APK-FORGE`.
5. Under repository permissions, set **Actions: Read and write**. Metadata read access is automatic.
6. Generate and copy the token. Save it privately. Do not put it in a file or commit it.

This token lets the Worker start the Android build workflow when the website submits a build.

## Part 5: Make two random secrets

Create two different long random values. Do not reuse one value for both.

- `API_TOKEN`: the password the APK FORGE website uses when it calls the Worker.
- `CALLBACK_SECRET`: the private password shared between the Worker and GitHub Actions.

`GH_DISPATCH_TOKEN` is the separate fine-grained GitHub token created in Part 4.

Use a password manager or a trusted random password generator. Never send these values in chat, screenshots, or public files.

## Part 6: Add GitHub repository secrets

Open the repository, then **Settings → Secrets and variables → Actions → New repository secret**. Add these six secrets using the exact names:

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token from Part 3 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID from Part 3 |
| `ALLOWED_ORIGIN` | Exact Netlify site origin, for example `https://your-site.netlify.app`, with no ending slash |
| `API_TOKEN` | Your first random secret |
| `GH_DISPATCH_TOKEN` | GitHub fine-grained token from Part 4 |
| `CALLBACK_SECRET` | Your second random secret |

Use different values for `CALLBACK_SECRET` and `API_TOKEN`. Do not reuse the GitHub token as either one.

Important: `ALLOWED_ORIGIN` is only the website origin. Do not paste a page path such as `/index.html` and do not add a trailing slash. Use the exact domain currently shown in your Netlify site dashboard.

## Part 7: Run the installer from Android

1. Open the repository's **Actions** tab.
2. If GitHub asks, enable Actions for the repository.
3. Select **Install and Deploy APK FORGE** from the workflow list.
4. Tap **Run workflow**.
5. Keep branch set to `main`.
6. In the confirmation field, type exactly `DEPLOY`.
7. Tap the green **Run workflow** button.
8. Open the running workflow and wait for all steps to finish.

The workflow extracts the ZIP, saves the project files into the repository, installs the tools, creates R2 storage, deploys the Worker, and configures its private secrets. If a step turns red, open that step and read its error. Do not keep rerunning it without fixing the reported problem.

## Part 8: Save the Worker URL as a GitHub variable

After a successful deployment, open the workflow run and find the step named **Deploy the APK FORGE API Worker**. Copy the URL ending in `.workers.dev`.

Then open **Repository Settings → Secrets and variables → Actions → Variables → New repository variable** and create:

- Name: `WORKER_URL`
- Value: the copied Worker URL, without a trailing slash

The URL is not a password, so it is stored as a repository variable, not a secret. The Android build workflow reads it from this variable.

## Part 9: Update the existing Netlify frontend

The package includes `frontend/index.html`. It is the existing APK FORGE page with the required API compatibility and download fixes applied.

Upload this `index.html` to the root of the existing Netlify site, replacing the previous file. Use the Netlify site's normal manual deploy/upload method. Do not create a new Netlify site unless you intend to change the website address.

On the website:

1. Enter the Worker URL in **Build API base URL**.
2. Enter your `API_TOKEN` in **Short-lived API token**.
3. Tap **Test API connection**. It should report HTTP 200.
4. Select a small Android Gradle ZIP that contains `gradlew`, Gradle settings, and an Android app module.
5. Choose **Debug APK** and **Auto detect**.
6. Tick the project ownership permission box and start the build.

The API token is kept only in the current browser session. Do not save it in local storage or share it.

## API endpoints

- `GET /health`
- `POST /build`
- `GET /build/{jobId}`
- `GET /download/{jobId}`
- Internal authenticated GitHub Actions routes under `/internal/jobs/{jobId}/...`

The frontend uses polling. The events endpoint is not enabled.

## Security notes

- Keep the Netlify page private or restrict access. This initial system uses one shared API token and is not a public multi-user SaaS service.
- Never commit API tokens, Cloudflare credentials, GitHub tokens, signing keys, or passwords.
- Uploaded Gradle projects execute build scripts. Only upload trusted projects you own or are authorized to build.
- GitHub Actions and Cloudflare have usage limits and may charge depending on your plan and usage. Check current plan limits.
- The initial prototype has no automatic R2 cleanup. Delete old source and artifact objects from R2 when they are no longer needed.

## Troubleshooting

- **Installer workflow is missing:** ensure `.github/workflows/install-apk-forge.yml` was created on `main` and Actions is enabled.
- **Git push from installer is denied:** open Repository Settings → Actions → General → Workflow permissions and allow read and write permissions for `GITHUB_TOKEN`, if repository policy permits it.
- **ZIP missing:** confirm the uploaded file is named exactly `APK-FORGE-STARTER.zip` and is in the repository root.
- **Cloudflare authorization error:** verify the Cloudflare API token permissions and Account ID.
- **R2 bucket creation failed:** check that the token includes Workers R2 Storage Edit permission and the bucket name is available.
- **Worker secret step failed:** verify all three required secret values are present and non-empty.
- **GitHub dispatch returns 401 or 403:** check the fine-grained token owner, selected repository, and Actions Read and write permission. Recreate the token if it expired.
- **Website CORS error:** `ALLOWED_ORIGIN` must exactly match the Netlify origin, including `https://` and excluding a trailing slash.
- **Build says no Gradle wrapper:** the uploaded project ZIP must contain `gradlew` and the Gradle wrapper files.
- **Build fails in Gradle:** open the `APK FORGE Android Build` workflow run and inspect the Gradle output. A workflow can install tools automatically, but it cannot make an incompatible Android project compile successfully.
