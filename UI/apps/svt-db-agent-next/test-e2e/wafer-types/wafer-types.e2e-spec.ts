import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { EpicWaferType, EpicWaferTypeMap } from 'epic-api-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaWaferTypes } from 'epic-api-types/kafka'

import { TestSetup } from '../utils'


const ER2_MAP = readFileSync(resolve(__dirname, '../../../../../Configurations/WaferTypeMappings/ER2WaferMap_v0.json'), 'utf8')

/** The smallest map the validation accepts: one group of two ASICs, one row, one column. */
const SMALL_MAP = JSON.stringify({
    Groups: { Group_0: [{ PosInGroup: 0, FamilyType: 'MOSAIX' }, { PosInGroup: 1, FamilyType: 'BABYMOSAIX' }] },
    MapGroups: {
        MapGroupsRow0: {
            MapGroupsColumns: [{
                GroupName: 'Group_0',
                ExistingAsics: ['All'],
                MechanicallyDamagedASICs: [],
                ASICsCoveredByGreenLayer: [],
                MechanicallyIntegerASICs: ['All'],
            }],
        },
    },
})

const ER2 = { name: 'ER2', engineeringRun: 'ER2', foundry: 'TowerSemiconductor', technology: 'TPSCo65', waferMap: ER2_MAP }
const ER1 = { name: 'ER1', engineeringRun: 'ER1', foundry: 'TowerSemiconductor', technology: 'TPSCo65', waferMap: SMALL_MAP }

type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicWaferType>
type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicWaferType>
type MapReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicWaferTypeMap>

describe('Wafer types (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())
    beforeEach(() => setup.clearDatabase())

    /** Seeds a wafer type through the agent itself, as a client would. */
    async function createWaferType(create = ER2): Promise<EpicWaferType> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({ create }))
        if (reply.status !== 'Success') {
            throw new Error(`createWaferType failed: ${reply.error.message}`)
        }
        return reply.data.entity
    }

    // ── CreateWaferType ───────────────────────────────────────────

    describe('CreateWaferType', () => {

        it('creates the wafer type and its map in one go', async () => {
            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({ create: ER2 }))

            expect(reply).toMatchObject({ type: 'CreateWaferTypeReply', status: 'Success', error: { code: 0, message: '' } })
            expect(reply.data).toEqual({
                entity: { id: 1, name: 'ER2', engineeringRun: 'ER2', foundry: 'TowerSemiconductor', technology: 'TPSCo65' },
            })

            const types = await setup.query('select id, name, "engineeringRun", foundry, technology from main."WaferType"')
            expect(types).toEqual([{ id: 1, name: 'ER2', engineeringRun: 'ER2', foundry: 'TowerSemiconductor', technology: 'TPSCo65' }])
            const maps = await setup.query('select "waferTypeId", "waferMap"->>\'FileName\' as file from main."WaferTypeMap"')
            expect(maps).toEqual([{ waferTypeId: 1, file: 'ER2WaferMap_v0.json' }])
        })

        it('tolerates the extra top-level data.waferMap key the C++ agent required', async () => {
            const reply = await setup.send({ type: 'CreateWaferType', data: { create: ER1, waferMap: SMALL_MAP } })

            expect(reply.status).toBe('Success')
        })

        it('rejects an invalid wafer map with every violation and writes nothing', async () => {
            const badMap = JSON.stringify({
                Groups: { Group_0: [{ PosInGroup: 1, FamilyType: 'NOT_A_TYPE' }] },
                MapGroups: {},
            })
            const reply = await setup.send(
                new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({ create: { ...ER1, waferMap: badMap } }),
            )

            expect(reply.status).toBe('BadRequest')
            expect(reply.data).toBeNull()
            expect(reply.error.message).toContain('Unmatching PosInGroup index: 1 from expected 0 in group Group_0')
            expect(reply.error.message).toContain('Asic Family type: NOT_A_TYPE is not part of enum value in the DB')
            expect(await setup.query('select count(*)::int as n from main."WaferType"')).toEqual([{ n: 0 }])
        })

        it('rejects a body with a missing field or an unknown key', async () => {
            const { technology, ...withoutTechnology } = ER1
            void technology
            const missing = await setup.send({ type: 'CreateWaferType', data: { create: withoutTechnology } })
            const unknown = await setup.send({ type: 'CreateWaferType', data: { create: { ...ER1, colour: 'blue' } } })

            expect(missing.status).toBe('BadRequest')
            expect(missing.error.message).toContain('technology')
            expect(unknown.status).toBe('BadRequest')
            expect(unknown.error.message).toContain('colour')
        })

        it('rejects a value that is not in the enum', async () => {
            const reply = await setup.send(
                new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({ create: { ...ER1, engineeringRun: 'ER99' } }),
            )

            expect(reply.status).toBe('BadRequest')
            expect(reply.error.message).toBe('ER99 is not a value of the engineeringRun enum')
        })

        it('rejects a duplicate name as BadRequest and keeps the first entry', async () => {
            await createWaferType(ER2)
            const reply = await setup.send(new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({ create: { ...ER1, name: 'ER2' } }))

            expect(reply.status).toBe('BadRequest')
            expect(reply.error.message).toContain('already exists')
            expect(await setup.query('select count(*)::int as n from main."WaferType"')).toEqual([{ n: 1 }])
        })

    })

    // ── GetAllWaferTypes ──────────────────────────────────────────

    describe('GetAllWaferTypes', () => {

        it('returns an empty page on an empty database', async () => {
            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaWaferTypes.GetAllWaferTypesMessage())

            expect(reply).toMatchObject({ type: 'GetAllWaferTypesReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [], totalCount: 0 })
        })

        it('lists the wafer types in id order, without their maps, and filters by ids', async () => {
            const er2 = await createWaferType(ER2)
            const er1 = await createWaferType(ER1)

            const all = await setup.send<ListReply>(new SvtDbAgentKafkaWaferTypes.GetAllWaferTypesMessage())
            expect(all.data).toEqual({ items: [er2, er1], totalCount: 2 })
            expect(Object.keys(all.data.items[0])).toEqual(['id', 'name', 'engineeringRun', 'foundry', 'technology'])

            const filtered = await setup.send<ListReply>({ type: 'GetAllWaferTypes', data: { filter: { ids: [er1.id] } } })
            expect(filtered.data).toEqual({ items: [er1], totalCount: 1 })
        })

    })

    // ── GetWaferTypeMap ───────────────────────────────────────────

    describe('GetWaferTypeMap', () => {

        it('returns the stored map as a JSON string', async () => {
            const er2 = await createWaferType(ER2)

            const reply = await setup.send<MapReply>({ type: 'GetWaferTypeMap', data: { waferTypeId: er2.id } })

            expect(reply).toMatchObject({ type: 'GetWaferTypeMapReply', status: 'Success' })
            expect(typeof reply.data.entity.waferMap).toBe('string')
            expect(JSON.parse(reply.data.entity.waferMap)).toEqual(JSON.parse(ER2_MAP))
        })

        it('answers NotFound for a wafer type without a map', async () => {
            const reply = await setup.send({ type: 'GetWaferTypeMap', data: { waferTypeId: 999 } })

            expect(reply).toEqual({
                type: 'GetWaferTypeMapReply',
                status: 'NotFound',
                data: null,
                error: { code: -1, message: 'No wafer map for wafer type 999' },
            })
        })

        it('answers BadRequest when waferTypeId is missing or not an integer', async () => {
            const missing = await setup.send({ type: 'GetWaferTypeMap', data: {} })
            const wrong = await setup.send({ type: 'GetWaferTypeMap', data: { waferTypeId: '1' } })

            expect(missing.status).toBe('BadRequest')
            expect(wrong.status).toBe('BadRequest')
            expect(wrong.error.message).toBe('data.waferTypeId must be an integer')
        })

    })

})
