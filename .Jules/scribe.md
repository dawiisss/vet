## 2025-03-05 - Native Dependencies Rebuild Context
**Learning:** Native packages such as `node-pty` may throw errors in Jest tests when `node_modules` are reinstalled if postinstall scripts are ignored by `pnpm`. Running tests will result in a mocked native library failure.
**Action:** Always ensure that `pnpm approve-builds` or `pnpm config set ignore-scripts false && pnpm rebuild` is run if native dependencies like `node-pty` or `electron` are updated or reinstalled to prevent phantom test failures.
