'use strict'

// Runs DbAgentNext's built `dist/main.js` (argv[2]) for the e2e harness (test-e2e/utils/e2e-agent-process.ts).
//
// The harness stops the agent with the IPC message 'shutdown', and a vanished parent (Ctrl+C, a crashed run) closes
// the IPC channel: both become the SIGTERM that NestJS's shutdown hooks (`app.enableShutdownHooks()` in the agent's
// main.ts) listen for. A plain `kill()` cannot do that on Windows, where it terminates the process at once: the
// agent would not leave its Kafka group, and the next run would find the group still holding a member.
const stop = () => process.emit('SIGTERM', 'SIGTERM')

process.on('message', (message) => {
    if (message === 'shutdown') {
        stop()
    }
})
process.on('disconnect', stop)

require(process.argv[2])
