// @vitest-environment node
import { KafkaContext } from '@nestjs/microservices'
import { EpicUserRole } from 'svt-ts-types'
import { SvtDbAgentKafkaUsers, SvtDbAgentKafkaWafers } from 'svt-ts-types/kafka'

import { EpicWafersService } from '../services'

import { EpicWafersController } from './epic-wafers-controller'


/** A stored hash, as the BFF makes it; it must never reach the console. */
const HASH = 'scrypt$32768$8$1$c2FsdC1vZi10aGUtdGVzdA$a2V5LW9mLXRoZS10ZXN0'

describe('EpicWafersController: the log of the Kafka topics', () => {

    const context = { getMessage: () => ({ headers: { svt_userId: '1' } }) } as unknown as KafkaContext
    let controller: EpicWafersController
    let log: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        controller = new EpicWafersController({} as EpicWafersService)
        log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    })

    afterEach(() => {
        log.mockRestore()
    })

    /** Everything the controller printed, as one text. */
    function printed(): string {
        return log.mock.calls.map((args) => args.map(String).join(' ')).join('\n')
    }

    it('prints a request of the user messages with the hash redacted', () => {
        const create = new SvtDbAgentKafkaUsers.CreateUserMessage({
            create: { login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert, passwordHash: HASH },
        })
        const password = new SvtDbAgentKafkaUsers.UpdateUserPasswordMessage({ id: 7, passwordHash: HASH })

        controller.handleDbRequest(JSON.parse(JSON.stringify(create)), context)
        controller.handleDbRequest(JSON.parse(JSON.stringify(password)), context)

        expect(printed()).not.toContain(HASH)
        expect(printed()).toContain('"passwordHash": "[redacted]"')
        expect(printed()).toContain('"login": "jane.doe"')
    })

    it('prints the headers of a reply, never its body: the reply of GetUserCredentials holds the hash', () => {
        const reply = new SvtDbAgentKafkaUsers.GetUserCredentialsReplyMessage({
            entity: {
                id: 7,
                login: 'jane.doe',
                name: 'Jane Doe',
                role: EpicUserRole.Expert,
                isActive: true,
                createdAt: '2026-11-27T12:00:00.000Z',
                passwordHash: HASH,
            },
        })

        controller.handleDbRequestReply(reply as unknown as SvtDbAgentKafkaWafers.ReplyMessage, context)

        expect(log).toHaveBeenCalledTimes(1)
        expect(printed()).not.toContain(HASH)
        expect(printed()).not.toContain('jane.doe')
        expect(printed()).toContain('svt_userId')
    })

})
