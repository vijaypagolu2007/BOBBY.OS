# Contributing to BOBBY.OS

Thanks for contributing. Small, focused pull requests are easiest to review and safest to release.

## Local setup

1. Fork the repository and create a branch from `main`.
2. Run `npm install`.
3. Copy `.env.example` to `.env` if you need live Firebase services. Never commit `.env` or credential files.
4. Run `npm run dev` to start the web app.

## Development workflow

- Keep feature entry points small and place focused code under the relevant feature directory, such as `js/features/power/`.
- Add or update unit tests for non-DOM logic and Playwright tests for a user-visible flow.
- Before opening a pull request, run:

  ```bash
  npm run check
  npm test
  ```

- Use `npm run lint:fix` and `npm run format` to apply automated fixes.

## Pull requests

- Link the relevant issue and explain the user-facing change.
- Include verification steps and screenshots for visual changes when useful.
- Keep unrelated refactors out of the pull request.
- Ensure CI passes before requesting review.

## Reporting issues

Use the bug-report or feature-request form. Include clear reproduction steps for bugs, but do not include Firebase keys, personal data, or production user data.

## Deployments

Repository administrators must add `FIREBASE_SERVICE_ACCOUNT` and `FIREBASE_PROJECT_ID` as repository secrets before deployments can run. Pushes to `main` deploy changed Functions files to the protected `production` environment. Pull requests from the same repository create a Firebase Hosting preview channel in the `staging` environment; previews intentionally do not run for forked pull requests because secrets are unavailable there.
