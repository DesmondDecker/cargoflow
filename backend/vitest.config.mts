import { defineConfig } from 'vitest/config';

// Scope is deliberate: this project has no reachable database in CI or in
// the sandbox this was built in (confirmed directly — mongodb-memory-server
// can install but can't download a real mongod binary here, see the
// session's own test log), so this config only ever points at pure-logic
// tests — functions with no Mongoose/DB dependency. Anything that touches a
// model belongs in a real integration suite run against an actual MongoDB,
// not here.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
