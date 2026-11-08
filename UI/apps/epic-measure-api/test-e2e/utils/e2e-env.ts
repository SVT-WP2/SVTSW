import { loadEpicApiE2eConfig } from './e2e-config'


// Runs before every spec file (vitest `setupFiles`), in the worker that boots the BFF: the application's
// ConfigModule resolves `.env.<NODE_ENV>` against the working directory (the workspace root under nx), so the
// app's env files are loaded here instead. Tests run in UTC, like the unit suite.
process.env.TZ = 'UTC'
loadEpicApiE2eConfig()
