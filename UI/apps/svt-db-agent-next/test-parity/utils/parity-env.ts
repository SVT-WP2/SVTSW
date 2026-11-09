import { resolve } from 'node:path'

import { config as loadEnv } from 'dotenv'


// Runs before every parity spec (vitest `setupFiles`). The client only needs the broker address, which comes
// from the same files as the e2e suite, with the same precedence:
//   process environment (a one-off override)  >  .env.test.local (git-ignored)  >  .env.test
process.env.NODE_ENV = 'test'
loadEnv({ path: resolve(__dirname, '../../.env.test.local') })
loadEnv({ path: resolve(__dirname, '../../.env.test') })
