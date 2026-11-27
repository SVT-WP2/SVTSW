import { EpicUser, EpicUserRole } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'

import { E2eRequestHeaders, TestSetup } from './test-setup'


type UserReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicUser>

/**
 * Creates a user through the agent, as the BFF does, and returns its id. The hash is a test value, not the hash of a
 * password: the agent stores it as an opaque string.
 */
export async function createE2eUser(setup: TestSetup, login: string, name: string): Promise<number> {
    const reply = await setup.send<UserReply>(new SvtDbAgentKafkaUsers.CreateUserMessage({
        create: { login, name, role: EpicUserRole.User, passwordHash: `test-hash-${login}` },
    }))
    expect(reply.status, reply.error.message).toBe('Success')
    return reply.data.entity.id
}

/** Switches a user off (`isActive` false), as an Admin does in the UI. */
export async function switchOffE2eUser(setup: TestSetup, id: number): Promise<void> {
    const reply = await setup.send(new SvtDbAgentKafkaUsers.UpdateUserMessage({ id, update: { isActive: false } }))
    expect(reply.status, reply.error.message).toBe('Success')
}

/** The header `svt_userId` of a request for this user. */
export function asE2eUser(id: number): E2eRequestHeaders {
    return { userId: String(id) }
}

/**
 * The number of SQL statements that `run` sends to the database, the dispatcher's own included. A list that resolves
 * a name per row sends more statements for more rows; a list that resolves them per page sends the same number.
 */
export async function countE2eQueries(setup: TestSetup, run: () => Promise<unknown>): Promise<number> {
    const execute = vi.spyOn(setup.getOrm().em.getConnection(), 'execute')
    try {
        await run()
        return execute.mock.calls.length
    }
    finally {
        execute.mockRestore()
    }
}
