// @vitest-environment node
import { EpicUserRole } from 'svt-ts-types'
import { SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'

import { EPIC_REDACTED_VALUE, redactEpicKafkaSecrets } from './epic-kafka-log.models'


describe('redactEpicKafkaSecrets', () => {

    const hash = 'scrypt$32768$8$1$c2FsdA$a2V5'

    it('hides the hash of CreateUser and UpdateUserPassword, and keeps the rest of the message', () => {
        const create = new SvtDbAgentKafkaUsers.CreateUserMessage({
            create: { login: 'jane', name: 'Jane', role: EpicUserRole.User, passwordHash: hash },
        })
        const password = new SvtDbAgentKafkaUsers.UpdateUserPasswordMessage({ id: 7, passwordHash: hash })

        expect(redactEpicKafkaSecrets(JSON.parse(JSON.stringify(create)))).toEqual({
            type: 'CreateUser',
            data: { create: { login: 'jane', name: 'Jane', role: 'User', passwordHash: EPIC_REDACTED_VALUE } },
        })
        expect(JSON.stringify(redactEpicKafkaSecrets(password))).not.toContain(hash)
        expect(redactEpicKafkaSecrets(password)).toMatchObject({ data: { id: 7, passwordHash: EPIC_REDACTED_VALUE } })
    })

    it('hides plain passwords at any depth, also inside arrays, and does not change the original', () => {
        const message = { data: { items: [{ password: 'secret-1' }, { nested: { currentPassword: 'a', newPassword: 'b' } }] } }

        expect(redactEpicKafkaSecrets(message)).toEqual({
            data: {
                items: [
                    { password: EPIC_REDACTED_VALUE },
                    { nested: { currentPassword: EPIC_REDACTED_VALUE, newPassword: EPIC_REDACTED_VALUE } },
                ],
            },
        })
        expect(message.data.items[0]).toEqual({ password: 'secret-1' })
    })

    it('keeps values that are no objects', () => {
        expect(redactEpicKafkaSecrets(null)).toBeNull()
        expect(redactEpicKafkaSecrets(undefined)).toBeUndefined()
        expect(redactEpicKafkaSecrets('text')).toBe('text')
        expect(redactEpicKafkaSecrets(3)).toBe(3)
    })

})
