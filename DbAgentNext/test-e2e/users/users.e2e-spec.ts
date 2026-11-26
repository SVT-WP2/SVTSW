import { EpicUser, EpicUserRole } from 'svt-ts-types'
import { EpicUserCreate, EpicUserCredentials, SvtDbAgentKafka, SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'

import { expectListPaging, TestSetup } from '../utils'


/** Arbitrary strings in place of the hashes that the BFF makes. Never a real hash. */
const HASH_ANNA = 'test-hash-anna'
const HASH_BRUNO = 'test-hash-bruno'
const HASH_CARLA = 'test-hash-carla'
const HASH_NEW = 'test-hash-new'

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const USER_KEYS = ['id', 'login', 'name', 'role', 'isActive', 'createdAt']

const ANNA: EpicUserCreate = { login: 'anna.rossi', name: 'Anna Rossi', role: EpicUserRole.Admin, passwordHash: HASH_ANNA }
const BRUNO: EpicUserCreate = { login: 'bruno', name: 'Bruno Weber', role: EpicUserRole.Developer, passwordHash: HASH_BRUNO }
const CARLA: EpicUserCreate = { login: 'carla_2', name: 'Carla Novak', role: EpicUserRole.User, passwordHash: HASH_CARLA }

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicUser>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicUser>
type CredentialsReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicUserCredentials>

type UserRow = {
    id: number
    login: string
    name: string
    role: string
    passwordHash: string
    isActive: boolean
}

describe('Users (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(() => setup.clearDatabase())

    async function create(user: EpicUserCreate): Promise<EpicUser> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaUsers.CreateUserMessage({ create: user }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity
    }

    async function getAll(data: SvtDbAgentKafkaUsers.GetAllUsersMessageData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaUsers.GetAllUsersMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    function update(id: number, change: SvtDbAgentKafkaUsers.UserUpdate) {
        return setup.send<EntityReply>(new SvtDbAgentKafkaUsers.UpdateUserMessage({ id, update: change }))
    }

    function rows(): Promise<UserRow[]> {
        return setup.query<UserRow>('select id, login, name, role, "passwordHash", "isActive" from main."SvtUser" order by id')
    }

    /** Waits until `count` sessions of this database wait for a lock (a table lock or a row lock). */
    async function waitForLockWaits(count: number): Promise<void> {
        for (let attempt = 0; attempt < 250; attempt++) {
            const [{ n }] = await setup.query<{ n: number }>(
                'select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = \'Lock\'',
            )
            if (n >= count) {
                return
            }
            await new Promise((resolve) => setTimeout(resolve, 20))
        }
        throw new Error(`Fewer than ${count} sessions wait for a lock`)
    }

    describe('GetAllUsers', () => {

        it('lists the users in id order, without the password hash', async () => {
            const anna = await create(ANNA)
            const bruno = await create(BRUNO)
            const carla = await create(CARLA)

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaUsers.GetAllUsersMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllUsersReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [anna, bruno, carla], totalCount: 3 })
            for (const item of reply.data.items) {
                expect(Object.keys(item)).toEqual(USER_KEYS)
                expect(item).not.toHaveProperty('passwordHash')
            }
            await expectListPaging(setup, 'GetAllUsers', reply.data.items)
        })

        it('filters by ids, roles and isActive, and a row must match every filter', async () => {
            const anna = await create(ANNA)
            const bruno = await create(BRUNO)
            const carla = await create(CARLA)
            const switchedOff = await update(carla.id, { isActive: false })
            expect(switchedOff.status, switchedOff.error.message).toBe('Success')
            const inactiveCarla = { ...carla, isActive: false }

            expect(await getAll({ filter: { ids: [1, 3] } })).toEqual({ items: [anna, inactiveCarla], totalCount: 2 })
            expect(await getAll({ filter: { roles: [EpicUserRole.Admin, EpicUserRole.User] } }))
                .toEqual({ items: [anna, inactiveCarla], totalCount: 2 })
            expect(await getAll({ filter: { isActive: true } })).toEqual({ items: [anna, bruno], totalCount: 2 })
            expect(await getAll({ filter: { isActive: false } })).toEqual({ items: [inactiveCarla], totalCount: 1 })
            expect(await getAll({ filter: { ids: [1, 3], isActive: true } })).toEqual({ items: [anna], totalCount: 1 })
            expect(await getAll({ filter: { ids: [], roles: [] } })).toEqual({ items: [anna, bruno, inactiveCarla], totalCount: 3 })
            const nulls = await setup.send<ListReply>({ type: 'GetAllUsers', data: { filter: { ids: null, roles: null, isActive: null } } })
            expect(nulls.data).toEqual({ items: [anna, bruno, inactiveCarla], totalCount: 3 })
        })

        it('rejects an unknown filter key, a role that is no value of the enum and values of the wrong type', async () => {
            await create(ANNA)
            const cases: [unknown, string][] = [
                [{ login: 'anna.rossi' }, 'Error: login is not an allowed filter.'],
                [{ roles: ['Boss'] }, 'Error: "Boss" is not a value of the userRole enum'],
                [{ roles: 'Admin' }, 'data.filter.roles must be a list of strings'],
                [{ ids: ['1'] }, 'data.filter.ids must be a list of integers'],
                [{ isActive: 'yes' }, 'data.filter.isActive must be a boolean'],
            ]
            for (const [filter, message] of cases) {
                const reply = await setup.send({ type: 'GetAllUsers', data: { filter } })
                expect(reply).toMatchObject({ status: 'BadRequest', data: null, error: { code: -1, message } })
            }
        })

        it('answers an empty list while there are no users, also without data', async () => {
            const reply = await setup.send<ListReply>({ type: 'GetAllUsers' })

            expect(reply.status).toBe('Success')
            expect(reply.data).toEqual({ items: [], totalCount: 0 })
        })

    })

    describe('GetUserCredentials', () => {

        it('finds the user by login in any case and with spaces around it, with the password hash', async () => {
            const anna = await create(ANNA)

            for (const login of ['anna.rossi', 'Anna.Rossi', '  ANNA.ROSSI  ']) {
                const reply = await setup.send<CredentialsReply>(new SvtDbAgentKafkaUsers.GetUserCredentialsMessage({ login }))

                expect(reply).toMatchObject({ type: 'GetUserCredentialsReply', status: 'Success' })
                expect(reply.data).toEqual({ entity: { ...anna, passwordHash: HASH_ANNA } })
                expect(Object.keys(reply.data.entity)).toEqual([...USER_KEYS, 'passwordHash'])
            }
        })

        it('returns an inactive user like any other', async () => {
            await create(ANNA)
            const bruno = await create(BRUNO)
            expect((await update(bruno.id, { isActive: false })).status).toBe('Success')

            const reply = await setup.send<CredentialsReply>(new SvtDbAgentKafkaUsers.GetUserCredentialsMessage({ login: 'bruno' }))

            expect(reply.status).toBe('Success')
            expect(reply.data.entity).toEqual({ ...bruno, isActive: false, passwordHash: HASH_BRUNO })
        })

        it('answers NotFound for an unknown login', async () => {
            await create(ANNA)

            for (const login of ['anna', 'nobody', '']) {
                const reply = await setup.send(new SvtDbAgentKafkaUsers.GetUserCredentialsMessage({ login }))

                expect(reply).toEqual({
                    type: 'GetUserCredentialsReply',
                    status: 'NotFound',
                    data: null,
                    error: { code: -1, message: 'No user with this login' },
                })
            }
        })

        it('rejects a missing or non-string login and a missing data', async () => {
            const cases: [unknown, string][] = [
                [{}, 'data.login must be a string'],
                [{ login: 5 }, 'data.login must be a string'],
                [{ login: null }, 'data.login must be a string'],
                ['anna', 'data must be an object'],
            ]
            for (const [data, message] of cases) {
                const reply = await setup.send({ type: 'GetUserCredentials', data })
                expect(reply).toMatchObject({ status: 'BadRequest', error: { message } })
            }
        })

    })

    describe('CreateUser', () => {

        it('creates an active user, stores the login trimmed and in lower case, and replies without the hash', async () => {
            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaUsers.CreateUserMessage({
                create: { login: '  Anna.Rossi ', name: '  Anna Rossi ', role: EpicUserRole.Expert, passwordHash: HASH_ANNA },
            }))

            expect(reply).toMatchObject({ type: 'CreateUserReply', status: 'Success' })
            expect(reply.data.entity).toEqual({
                id: 1,
                login: 'anna.rossi',
                name: 'Anna Rossi',
                role: 'Expert',
                isActive: true,
                createdAt: expect.stringMatching(ISO_DATE_TIME),
            })
            expect(Object.keys(reply.data.entity)).toEqual(USER_KEYS)
            expect(await rows()).toEqual([
                { id: 1, login: 'anna.rossi', name: 'Anna Rossi', role: 'Expert', passwordHash: HASH_ANNA, isActive: true },
            ])
            expect(await setup.query('select "createdAt" is not null as stamped from main."SvtUser"')).toEqual([{ stamped: true }])
        })

        it('accepts the limits of each field, counted in characters as the columns count them', async () => {
            const longest = { login: `a.b_c-1${'x'.repeat(43)}`, name: 'N'.repeat(100), passwordHash: 'h'.repeat(255) }
            await create({ ...longest, role: EpicUserRole.Admin })
            await create({ login: 'abc', name: 'N', role: EpicUserRole.Developer, passwordHash: 'h' })
            // One emoji is two UTF-16 units and one character of a varchar.
            await create({ login: 'emoji', name: '😀'.repeat(100), role: EpicUserRole.User, passwordHash: '😀'.repeat(255) })

            const lengths = await setup.query<{ login: number; name: number; hash: number }>(
                'select char_length(login) as login, char_length(name) as name, char_length("passwordHash") as hash'
                + ' from main."SvtUser" order by id',
            )
            expect(lengths).toEqual([
                { login: 50, name: 100, hash: 255 },
                { login: 3, name: 1, hash: 1 },
                { login: 5, name: 100, hash: 255 },
            ])
        })

        it('rejects a login that exists already, also in another case', async () => {
            const anna = await create(ANNA)

            for (const login of ['anna.rossi', 'ANNA.ROSSI']) {
                const reply = await setup.send({ type: 'CreateUser', data: { create: { ...BRUNO, login } } })

                expect(reply).toEqual({
                    type: 'CreateUserReply',
                    status: 'BadRequest',
                    data: null,
                    error: { code: -1, message: 'Failed entry creation: an entry with the same unique value already exists' },
                })
            }
            expect(await rows()).toEqual([{ id: anna.id, ...ANNA, isActive: true }])
        })

        it('creates one user when two creates of one login come at the same time', async () => {
            const replies = await Promise.all([
                setup.send({ type: 'CreateUser', data: { create: ANNA } }),
                setup.send({ type: 'CreateUser', data: { create: { ...BRUNO, login: ANNA.login } } }),
            ])

            expect(replies.map((reply) => reply.status).sort()).toEqual(['BadRequest', 'Success'])
            expect(await rows()).toHaveLength(1)
        })

        it('rejects each broken validation rule and writes nothing', async () => {
            const cases: [unknown, string][] = [
                [{ ...BRUNO, login: undefined }, 'login'],
                [{ ...BRUNO, login: 5 }, 'login'],
                [{ ...BRUNO, login: 'ab' }, 'login'],
                [{ ...BRUNO, login: '  ab  ' }, 'login'],
                [{ ...BRUNO, login: 'a'.repeat(51) }, 'login'],
                [{ ...BRUNO, login: 'bruno weber' }, 'login'],
                [{ ...BRUNO, login: 'bruno@cern' }, 'login'],
                [{ ...BRUNO, login: 'brunö' }, 'login'],
                [{ ...BRUNO, name: undefined }, 'name'],
                [{ ...BRUNO, name: 7 }, 'name'],
                [{ ...BRUNO, name: '' }, 'name'],
                [{ ...BRUNO, name: '   ' }, 'name'],
                [{ ...BRUNO, name: 'N'.repeat(101) }, 'name'],
                [{ ...BRUNO, name: `${'N'.repeat(100)}️` }, 'name must be 1 to 100 characters long'],
                [{ ...BRUNO, role: undefined }, 'role'],
                [{ ...BRUNO, role: 'Boss' }, 'role'],
                [{ ...BRUNO, role: 'admin' }, 'role'],
                [{ ...BRUNO, passwordHash: undefined }, 'passwordHash'],
                [{ ...BRUNO, passwordHash: 42 }, 'passwordHash'],
                [{ ...BRUNO, passwordHash: '' }, 'passwordHash'],
                [{ ...BRUNO, passwordHash: 'h'.repeat(256) }, 'passwordHash'],
                [{ ...BRUNO, passwordHash: `${'h'.repeat(255)}️` }, 'passwordHash must be 1 to 255 characters long'],
                [{ ...BRUNO, isActive: false }, 'isActive'],
                [{ ...BRUNO, id: 9 }, 'id'],
                [undefined, 'data.create must be an object'],
            ]
            for (const [user, message] of cases) {
                const reply = await setup.send({ type: 'CreateUser', data: { create: user } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await rows()).toEqual([])
        })

        it('never puts the password hash into a validation message', async () => {
            const reply = await setup.send({ type: 'CreateUser', data: { create: { ...BRUNO, login: 'x', passwordHash: HASH_NEW } } })

            expect(reply.status).toBe('BadRequest')
            expect(reply.error.message).not.toContain(HASH_NEW)
        })

    })

    describe('UpdateUser', () => {

        it('changes the keys that are present and keeps the others', async () => {
            await create(ANNA)
            const bruno = await create(BRUNO)

            const renamed = await update(bruno.id, { name: '  Bruno W. ' })
            expect(renamed).toMatchObject({ type: 'UpdateUserReply', status: 'Success' })
            expect(renamed.data.entity).toEqual({ ...bruno, name: 'Bruno W.' })

            const changed = await update(bruno.id, { role: EpicUserRole.Expert, isActive: false })
            expect(changed.data.entity).toEqual({ ...bruno, name: 'Bruno W.', role: 'Expert', isActive: false })

            const nulls = await setup.send<EntityReply>({ type: 'UpdateUser', data: { id: bruno.id, update: { name: null, role: null } } })
            expect(nulls.status, nulls.error.message).toBe('Success')
            expect(nulls.data.entity).toEqual(changed.data.entity)

            const nothing = await update(bruno.id, {})
            expect(nothing.data.entity).toEqual(changed.data.entity)

            expect((await rows())[1]).toEqual({
                id: bruno.id, login: 'bruno', name: 'Bruno W.', role: 'Expert', passwordHash: HASH_BRUNO, isActive: false,
            })
        })

        it('answers NotFound for a user that does not exist', async () => {
            await create(ANNA)

            const reply = await update(99, { name: 'Nobody' })

            expect(reply).toEqual({
                type: 'UpdateUserReply',
                status: 'NotFound',
                data: null,
                error: { code: -1, message: 'No user with id 99' },
            })
        })

        it('rejects an invalid id, a missing update, the login and every broken rule', async () => {
            await create(ANNA)
            const bruno = await create(BRUNO)
            const cases: [unknown, string][] = [
                [{ id: '2', update: { name: 'X' } }, 'data.id must be an integer'],
                [{ update: { name: 'X' } }, 'data.id must be an integer'],
                [{ id: bruno.id }, 'data.update must be an object'],
                [{ id: bruno.id, update: { login: 'bruno.weber' } }, 'login'],
                [{ id: bruno.id, update: { passwordHash: HASH_NEW } }, 'passwordHash'],
                [{ id: bruno.id, update: { name: '' } }, 'name'],
                [{ id: bruno.id, update: { name: '   ' } }, 'name'],
                [{ id: bruno.id, update: { name: 'N'.repeat(101) } }, 'name'],
                [{ id: bruno.id, update: { name: `${'N'.repeat(100)}️` } }, 'name must be 1 to 100 characters long'],
                [{ id: bruno.id, update: { role: 'Boss' } }, 'role'],
                [{ id: bruno.id, update: { isActive: 'no' } }, 'isActive'],
            ]
            for (const [data, message] of cases) {
                const reply = await setup.send({ type: 'UpdateUser', data })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect((await rows())[1]).toEqual({ id: bruno.id, ...BRUNO, isActive: true })
        })

        it('keeps the last active Admin: it cannot be switched off or get another role', async () => {
            const anna = await create(ANNA)
            await create(BRUNO)

            for (const change of [{ isActive: false }, { role: EpicUserRole.Developer }, { role: EpicUserRole.User, isActive: false }]) {
                const reply = await update(anna.id, change)

                expect(reply).toEqual({
                    type: 'UpdateUserReply',
                    status: 'BadRequest',
                    data: null,
                    error: { code: -1, message: 'The installation must keep one active Admin' },
                })
            }
            expect((await rows())[0]).toMatchObject({ role: 'Admin', isActive: true })

            const renamed = await update(anna.id, { name: 'Anna R.', role: EpicUserRole.Admin, isActive: true })
            expect(renamed.status, renamed.error.message).toBe('Success')
        })

        it('does not count an inactive Admin as the other Admin', async () => {
            const anna = await create(ANNA)
            const second = await create({ ...BRUNO, role: EpicUserRole.Admin })
            expect((await update(second.id, { isActive: false })).status).toBe('Success')

            const reply = await update(anna.id, { isActive: false })

            expect(reply).toMatchObject({ status: 'BadRequest', error: { message: 'The installation must keep one active Admin' } })
        })

        it('allows the same changes while a second active Admin exists', async () => {
            const anna = await create(ANNA)
            const second = await create({ ...BRUNO, role: EpicUserRole.Admin })
            const third = await create({ ...CARLA, role: EpicUserRole.Admin })

            const switchedOff = await update(anna.id, { isActive: false })
            expect(switchedOff.status, switchedOff.error.message).toBe('Success')
            expect(switchedOff.data.entity).toMatchObject({ role: 'Admin', isActive: false })

            const demoted = await update(second.id, { role: EpicUserRole.Developer })
            expect(demoted.status, demoted.error.message).toBe('Success')
            expect(demoted.data.entity).toMatchObject({ role: 'Developer', isActive: true })

            const last = await update(third.id, { role: EpicUserRole.Expert })
            expect(last).toMatchObject({ status: 'BadRequest', error: { message: 'The installation must keep one active Admin' } })
            expect((await rows()).map((row) => [row.role, row.isActive])).toEqual([['Admin', false], ['Developer', true], ['Admin', true]])
        })

        it('lets only one of two updates at the same time remove an Admin of the last two', async () => {
            const anna = await create(ANNA)
            const second = await create({ ...BRUNO, role: EpicUserRole.Admin })

            // The test holds a lock that lets the agent read the table but not write it, until both updates wait.
            // Without the advisory lock of the agent, both updates would read two active Admins, and both would write.
            // `begin` and not `transactional`: the updates must not run inside the transaction of the test.
            const lock = setup.em()
            await lock.begin()
            await lock.execute('lock table main."SvtUser" in share mode')
            const both = Promise.all([
                update(anna.id, { isActive: false }),
                update(second.id, { role: EpicUserRole.Developer }),
            ])
            try {
                await waitForLockWaits(2)
            }
            finally {
                await lock.commit()
            }
            const replies = await both

            expect(replies.map((reply) => reply.status).sort()).toEqual(['BadRequest', 'Success'])
            const activeAdmins = await setup.query('select id from main."SvtUser" where role = \'Admin\' and "isActive"')
            expect(activeAdmins).toHaveLength(1)
        })

        it('switches off a user that is no Admin, also when no active Admin exists', async () => {
            const bruno = await create(BRUNO)

            const reply = await update(bruno.id, { isActive: false })

            expect(reply.status, reply.error.message).toBe('Success')
            expect(reply.data.entity.isActive).toBe(false)
        })

    })

    describe('A user entered by hand in the database (the first Admin, D4)', () => {

        function insertByHand(login: string) {
            return setup.query(
                'insert into main."SvtUser" (login, name, role, "passwordHash") values (?, ?, ?, ?)',
                [login, 'First Admin', 'Admin', HASH_ANNA],
            )
        }

        it('can log in when the login is trimmed and in lower case', async () => {
            await insertByHand('first.admin')

            const reply = await setup.send<CredentialsReply>(new SvtDbAgentKafkaUsers.GetUserCredentialsMessage({ login: 'First.Admin' }))

            expect(reply.status, reply.error.message).toBe('Success')
            expect(reply.data.entity).toMatchObject({ login: 'first.admin', role: 'Admin', isActive: true, passwordHash: HASH_ANNA })
        })

        it('is refused by the database when the login has an upper-case letter or a space around it', async () => {
            for (const login of ['Admin', 'ADMIN', ' admin', 'admin ']) {
                await expect(insertByHand(login), login).rejects.toThrow('SvtUser_login_check')
            }
            expect(await rows()).toEqual([])
        })

    })

    describe('UpdateUserPassword', () => {

        it('stores the new hash and replies with the user, without the hash', async () => {
            await create(ANNA)
            const bruno = await create(BRUNO)

            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaUsers.UpdateUserPasswordMessage({ id: bruno.id, passwordHash: HASH_NEW }),
            )

            expect(reply).toMatchObject({ type: 'UpdateUserPasswordReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: bruno })
            expect((await rows()).map((row) => row.passwordHash)).toEqual([HASH_ANNA, HASH_NEW])
            const credentials = await setup.send<CredentialsReply>(new SvtDbAgentKafkaUsers.GetUserCredentialsMessage({ login: 'bruno' }))
            expect(credentials.data.entity.passwordHash).toBe(HASH_NEW)
        })

        it('answers NotFound for a user that does not exist', async () => {
            const reply = await setup.send(new SvtDbAgentKafkaUsers.UpdateUserPasswordMessage({ id: 42, passwordHash: HASH_NEW }))

            expect(reply).toEqual({
                type: 'UpdateUserPasswordReply',
                status: 'NotFound',
                data: null,
                error: { code: -1, message: 'No user with id 42' },
            })
        })

        it('rejects an invalid id and a hash that is missing, not a string, empty or too long', async () => {
            const anna = await create(ANNA)
            const cases: [unknown, string][] = [
                [{ id: 'x', passwordHash: HASH_NEW }, 'data.id must be an integer'],
                [{ id: anna.id }, 'data.passwordHash must be a string'],
                [{ id: anna.id, passwordHash: 7 }, 'data.passwordHash must be a string'],
                [{ id: anna.id, passwordHash: '' }, 'data.passwordHash must be 1 to 255 characters long'],
                [{ id: anna.id, passwordHash: 'h'.repeat(256) }, 'data.passwordHash must be 1 to 255 characters long'],
                [{ id: anna.id, passwordHash: `${'h'.repeat(255)}️` }, 'data.passwordHash must be 1 to 255 characters long'],
            ]
            for (const [data, message] of cases) {
                const reply = await setup.send({ type: 'UpdateUserPassword', data })
                expect(reply).toMatchObject({ status: 'BadRequest', error: { message } })
            }
            expect((await rows())[0].passwordHash).toBe(HASH_ANNA)
        })

    })

})

describe('Users and the log (e2e)', () => {

    // The debug log is the one that writes every query with its values.
    const setup = new TestSetup({ env: { SVT_DB_AGENT_LOGGER_TERM_VERBOSITY: 'DEBUG' } })
    const lines: string[] = []

    beforeAll(async () => {
        await setup.init()
        const logger = setup.getOrm().config.getLogger() as unknown as { writer: (line: string) => void }
        vi.spyOn(logger, 'writer').mockImplementation((line: string) => {
            lines.push(line)
        })
    })
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        lines.length = 0
    })

    it('writes no password hash to the query log, also with the debug log on', async () => {
        const created = await setup.send<EntityReply>(new SvtDbAgentKafkaUsers.CreateUserMessage({ create: ANNA }))
        const id = created.data.entity.id
        const changed = await setup.send(new SvtDbAgentKafkaUsers.UpdateUserPasswordMessage({ id, passwordHash: HASH_NEW }))
        const read = await setup.send(new SvtDbAgentKafkaUsers.GetUserCredentialsMessage({ login: ANNA.login }))
        const listed = await setup.send(new SvtDbAgentKafkaUsers.GetAllUsersMessage({}))

        expect([created.status, changed.status, read.status, listed.status]).toEqual(['Success', 'Success', 'Success', 'Success'])
        expect(lines.some((line) => line.includes('SvtUser')), 'the query log is on').toBe(true)
        expect(lines.filter((line) => line.includes(HASH_ANNA) || line.includes(HASH_NEW))).toEqual([])
    })

})
