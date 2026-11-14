import { resolve } from 'node:path'

import { config as loadEnv } from 'dotenv'


// Runs before every spec file (vitest `setupFiles`). The application's ConfigModule resolves `.env.<NODE_ENV>`
// against the working directory, which is the workspace root under `nx test-e2e`, so the app's env files are
// loaded here instead. dotenv never overrides a variable that is already set, so the precedence is:
//   process environment (CI, a one-off override)  >  .env.test.local (git-ignored, personal credentials)  >  .env.test
process.env.NODE_ENV = 'test'
loadEnv({ path: resolve(__dirname, '../../.env.test.local') })
loadEnv({ path: resolve(__dirname, '../../.env.test') })

const dbName = process.env.SVT_DB_AGENT_DB_NAME ?? ''
if (!dbName.endsWith('_e2e_test')) {
    throw new Error(
        `Refusing to run the e2e suite against database "${dbName}": the harness truncates every table, `
        + 'so SVT_DB_AGENT_DB_NAME must end with _e2e_test.',
    )
}
