import { SvtDbAgentKafkaEnums } from 'epic-api-types/kafka'
import { SVT_DB_ENUM_VALUES } from 'svt-db/data'

import { TestSetup } from '../utils'


describe('Enums (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    describe('GetAllEnums', () => {

        it('returns every enum type of the schema with its live values, no wrapper', async () => {
            const reply = await setup.send<Record<string, string[]>>(new SvtDbAgentKafkaEnums.GetAllEnumsMessage({}))

            expect(reply.type).toBe('GetAllEnumsReply')
            expect(reply.status).toBe('Success')
            expect(Object.keys(reply.data).sort()).toEqual(Object.keys(SVT_DB_ENUM_VALUES).sort())
            expect(reply.data['engineeringRun']).toEqual(SVT_DB_ENUM_VALUES.engineeringRun)
            expect(reply.data['asicFamilyType']).toEqual(SVT_DB_ENUM_VALUES.asicFamilyType)
        })

        it('treats an empty enumNames list as "all" (what the BFF sends for an unfiltered request)', async () => {
            const all = await setup.send<Record<string, string[]>>(new SvtDbAgentKafkaEnums.GetAllEnumsMessage({}))
            const empty = await setup.send<Record<string, string[]>>(
                new SvtDbAgentKafkaEnums.GetAllEnumsMessage({ filter: { enumNames: [] } }),
            )

            expect(empty.status).toBe('Success')
            expect(Object.keys(empty.data).length).toBeGreaterThan(10)
            expect(empty.data).toEqual(all.data)
        })

        it('filters by data.filter.enumNames (contract) and leaves unknown names out', async () => {
            const reply = await setup.send<Record<string, string[]>>(
                new SvtDbAgentKafkaEnums.GetAllEnumsMessage({ filter: { enumNames: ['foundryName', 'noSuchEnum'] } }),
            )

            expect(reply.status).toBe('Success')
            expect(reply.data).toEqual({ foundryName: SVT_DB_ENUM_VALUES.foundryName })
        })

        it('also accepts the enumNames and enumsNames keys the clients send', async () => {
            const byEnumNames = await setup.send<Record<string, string[]>>({ type: 'GetAllEnums', data: { enumNames: ['waferTech'] } })
            const byEnumsNames = await setup.send<Record<string, string[]>>({ type: 'GetAllEnums', data: { enumsNames: ['waferTech'] } })

            expect(byEnumNames.data).toEqual({ waferTech: SVT_DB_ENUM_VALUES.waferTech })
            expect(byEnumsNames.data).toEqual({ waferTech: SVT_DB_ENUM_VALUES.waferTech })
        })

        it('rejects a filter that is not a list of strings', async () => {
            const reply = await setup.send({ type: 'GetAllEnums', data: { filter: { enumNames: 'waferTech' } } })

            expect(reply.status).toBe('BadRequest')
            expect(reply.data).toBeNull()
            expect(reply.error.message).toContain('data.filter.enumNames')
        })

    })

})
