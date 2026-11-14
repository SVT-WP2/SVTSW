import { SVT_DB_AGENT_NEXT_HEARTBEAT_TOPIC } from '../src/modules/kafka'

import {
    digestLongLists,
    PARITY_CASES,
    ParityClient,
    ParityRecordedCase,
    ParitySnapshot,
    writeSnapshot,
} from './utils'


/**
 * Plays every parity case against the DB agent that is consuming `svt.db-agent.request` on the broker of
 * `.env.test` and records the replies in `snapshots/<SVT_DB_AGENT_PARITY_AGENT>.json`. The agent under test is
 * started outside this spec (the C++ container or `svt-db-agent-next`), against a database freshly restored
 * from the 2026-11-08 dev dump; see `README.md`. Only the infrastructure is asserted here: a case that gets no
 * reply is recorded as such, and the recorder waits for the agent to serve again before the next one.
 */
const agent = process.env.SVT_DB_AGENT_PARITY_AGENT
const brokers = [`${process.env.SVT_DB_AGENT_KAFKA_SERVER}:${process.env.SVT_DB_AGENT_KAFKA_PORT}`]

const describeWithAgent = agent ? describe : describe.skip

describeWithAgent(`parity recording of "${agent}"`, () => {

    const client = new ParityClient(brokers)
    const snapshot: ParitySnapshot = { agent: agent ?? '', recordedAt: new Date().toISOString(), brokers, cases: {} }

    beforeAll(async () => {
        await client.connect()
        const waited = await client.waitUntilServing()
        console.info(`[parity] "${agent}" answered the probe after ${waited} ms`)
    })

    afterAll(async () => {
        const path = writeSnapshot(snapshot)
        console.info(`[parity] ${Object.keys(snapshot.cases).length} cases recorded to ${path}`)
        await client.disconnect()
    })

    for (const parityCase of PARITY_CASES) {
        it(parityCase.id, async () => {
            const started = Date.now()
            const { headers, outcome } = await client.send(parityCase.value, parityCase.headers)
            const durationMs = Date.now() - started
            const digested = digestLongLists(snapshot.agent, parityCase.id, outcome)
            const recorded: ParityRecordedCase = {
                id: parityCase.id,
                request: { value: parityCase.value, headers },
                outcome: digested.outcome,
                durationMs,
                ...(digested.digested ? { digested: true } : {}),
            }
            if (outcome.kind === 'timeout') {
                recorded.recoveredAfterMs = await client.waitUntilServing()
                console.info(`[parity] ${parityCase.id}: no reply; the agent served again after ${recorded.recoveredAfterMs} ms`)
            }
            snapshot.cases[parityCase.id] = recorded
            expect(recorded.outcome.kind).toMatch(/^(reply|timeout)$/)
        })
    }

    it('heartbeat', async () => {
        const record = await client.readNextRecord(SVT_DB_AGENT_NEXT_HEARTBEAT_TOPIC)
        const timestamp = (record as { timestamp?: unknown }).timestamp
        snapshot.heartbeat = {
            keys: typeof record === 'object' && record !== null ? Object.keys(record) : [],
            timestampType: typeof timestamp,
            timestampFormat: typeof timestamp === 'string' && /^\d{10}\.\d{6}$/.test(timestamp) ? 'epoch-seconds.6' : 'other',
        }
        expect(snapshot.heartbeat).toBeDefined()
    })

})
