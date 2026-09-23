# Bug Report: Incompatible TypeScript 7 in React Router templates causes `npm ci` failures in CI/CD (Coolify, Vercel, Cloudflare, Docker)

## Summary
When generating a React Router template (e.g. `react-router`, `react-router-docker`, `react-router-cloudflare`, `react-router-vercel`), `templates/react-router/package.json` installs `"typescript": "7.0.2"` in `devDependencies`.

However, React Router v7 (`@react-router/dev`, `@react-router/express`, `@react-router/node`) specifies:
```json
"peerDependencies": {
  "typescript": "^5.1.0 || ^6.0.0"
}
```

Because TypeScript 7 does not satisfy `^5.1.0 || ^6.0.0`, npm attempts to resolve `typescript@6.0.3` for React Router's nested packages and flags it as `extraneous: true`. When any subsequent package install, build, or prune runs, npm removes the nested lockfile entry. When deploying to any containerized or CI/CD platform that relies on `npm ci` (e.g., Coolify, Docker, Vercel, Cloudflare Pages, Railway), the build aborts immediately with:
```
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync.
npm error Missing: typescript@6.0.3 from lock file
```

---

## Steps to Reproduce

1. Initialize a Webstudio project with a React Router template:
   ```bash
   npx webstudio build --template react-router --template react-router-docker
   ```
2. Inspect `package.json`:
   ```json
   "devDependencies": {
     "typescript": "7.0.2"
   }
   ```
3. Run `npm install` and deploy the project to any CI/CD environment using a standard Dockerfile / Railpack build that executes `npm ci`.
4. The build fails during `npm ci`.

---

## Actual Behavior & Build Logs

```text
#13 copy package-lock.json
#14 copy package.json
#15 npm ci
#15 6.239 npm error code EUSAGE
#15 6.239 npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
#15 6.239 npm error
#15 6.239 npm error Missing: typescript@6.0.3 from lock file
#15 6.239 npm error
#15 ERROR: process "npm ci" did not complete successfully: exit code: 1
```

---

## Expected Behavior
`npm ci` should complete cleanly without peer dependency conflicts or missing lockfile records.

---

## Root Cause Analysis

1. In `node_modules/webstudio/templates/react-router/package.json`:
   ```json
   "devDependencies": {
     "@types/react": "^18.2.70",
     "@types/react-dom": "^18.2.25",
     "typescript": "7.0.2"
   }
   ```
2. In `@react-router/express` (dependency of `@react-router/serve`):
   ```json
   "peerDependencies": {
     "express": "^4.17.1 || ^5",
     "react-router": "7.x",
     "typescript": "^5.1.0 || ^6.0.0"
   },
   "peerDependenciesMeta": {
     "typescript": {
       "optional": true
     }
   }
   ```
3. Because root has `7.0.2`, npm detects that the peer dependency `^5.1.0 || ^6.0.0` is unsatisfied, leading to duplicate resolution, `extraneous` flags, and `package-lock.json` desynchronization.

---

## Proposed Fix

Update `templates/react-router/package.json` to use a TypeScript version matching React Router v7's `peerDependencies` (`^6.0.3` or `^5.8.0`):

```diff
--- a/templates/react-router/package.json
+++ b/templates/react-router/package.json
@@ -33,7 +33,7 @@
   "devDependencies": {
     "@types/react": "^18.2.70",
     "@types/react-dom": "^18.2.25",
-    "typescript": "7.0.2"
+    "typescript": "^6.0.3"
   },
   "engines": {
     "node": ">=22.12.0"
```

Once React Router officially bumps its `peerDependencies` range to include `|| ^7.0.0`, TypeScript 7 can be safely adopted.
