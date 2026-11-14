import { EpicWpProbeCard } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaWpProbeCards } from 'svt-ts-types/kafka'

import { insertProbeCard, TestSetup } from '../utils'


/** `ProbeCardDto` of the Kafka contract: `EpicWpProbeCard` plus `asicFamilyTypes`. */
type ProbeCardWire = EpicWpProbeCard & { asicFamilyTypes: string[] }

const CARD_1: ProbeCardWire = {
    id: 1,
    serialNumber: 'MVP251669H',
    name: 'NKF7_MPI',
    vendor: 'MPI',
    model: 'NKF7-TS3500-CABLEOUT-MLO(EVS-P)',
    arriveDate: '2025-06-06',
    location: 'CERN',
    type: 'Vertical',
    vendorCleaningInterval: 200,
    asicFamilyTypes: ['NKF7'],
}
/** Family types come back in the enum's order (MOSAIX precedes BABYMOSAIX there), not the insert order. */
const CARD_2: ProbeCardWire = {
    ...CARD_1, id: 2, serialNumber: 'MVP255241H', name: 'MOSAIX_LEC', asicFamilyTypes: ['MOSAIX', 'BABYMOSAIX'],
}
const CARD_3: ProbeCardWire = { ...CARD_1, id: 3, serialNumber: 'MVP000000H', name: 'BabyMOSS_Korea', asicFamilyTypes: [] }

type ListReply = SvtDbAgentKafka.PageReplyMessageData<ProbeCardWire>

describe('Probe cards (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        await insertProbeCard(setup, { serialNumber: CARD_1.serialNumber, name: CARD_1.name, asicFamilyTypes: ['NKF7'] })
        await insertProbeCard(setup, { serialNumber: CARD_2.serialNumber, name: CARD_2.name, asicFamilyTypes: ['BABYMOSAIX', 'MOSAIX'] })
        await insertProbeCard(setup, { serialNumber: CARD_3.serialNumber, name: CARD_3.name })
    })

    async function getAll(data: SvtDbAgentKafkaWpProbeCards.GetAllWpProbeCardsData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaWpProbeCards.GetAllWpProbeCardsMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    describe('GetAllProbeCards', () => {

        it('lists the probe cards in id order with their ASIC family types (R-3) and the date as YYYY-MM-DD', async () => {
            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaWpProbeCards.GetAllWpProbeCardsMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllProbeCardsReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [CARD_1, CARD_2, CARD_3], totalCount: 3 })
            expect(Object.keys(reply.data.items[0])).toEqual([
                'id', 'serialNumber', 'name', 'vendor', 'model', 'arriveDate', 'location', 'type', 'vendorCleaningInterval',
                'asicFamilyTypes',
            ])
        })

        it('filters by ids (an empty list means all), answers an empty list without cards and rejects an unknown filter key', async () => {
            expect(await getAll({ filter: { ids: [2] } })).toEqual({ items: [CARD_2], totalCount: 1 })
            expect((await getAll({ filter: { ids: [] } })).totalCount).toBe(3)
            expect(await getAll({ filter: { ids: [999] } })).toEqual({ items: [], totalCount: 0 })

            const unknown = await setup.send({ type: 'GetAllProbeCards', data: { filter: { vendor: 'MPI' } } })
            expect(unknown).toMatchObject({
                status: 'BadRequest', data: null, error: { message: 'Error: vendor is not an allowed filter.' },
            })

            await setup.clearDatabase()
            expect(await getAll()).toEqual({ items: [], totalCount: 0 })
        })

    })

})
