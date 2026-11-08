import { buildAgentIfStale, migrateAgentDatabase, startAgent } from './e2e-agent-process'
import { loadEpicApiE2eConfig } from './e2e-config'
import { ensureE2eDatabase } from './e2e-database'
import { prepareE2eBroker } from './e2e-kafka'


/**
 * Vitest global setup of the e2e suite: runs once per `vitest run`, in the main process, before any spec file.
 * Readies the e2e broker and database, builds and migrates DbAgentNext when needed, and starts it as a child
 * process for the whole run; the returned teardown stops it. Every spec file then boots its own BFF in-process
 * (`TestSetup`), which talks to this agent over the broker.
 */
export default async function setup(): Promise<() => Promise<void>> {
    const config = loadEpicApiE2eConfig()

    await prepareE2eBroker(config.kafkaBroker)
    await ensureE2eDatabase(config.database)
    buildAgentIfStale()
    await migrateAgentDatabase(config)
    const agent = await startAgent(config)

    return async () => {
        const stopping = Date.now()
        await agent.stop()
        console.info(`[e2e] DbAgentNext stopped in ${Date.now() - stopping} ms`)
    }
}
