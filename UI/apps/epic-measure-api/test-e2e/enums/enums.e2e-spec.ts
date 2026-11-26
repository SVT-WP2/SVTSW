import { EpicEnumName, EpicEnumsCollectionResponse } from 'svt-ts-types'

import { expectStatus, TestSetup } from '../utils'


describe('Enums (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    /** The enum types of the agent's schema with their values in declaration order: what the agent answers with. */
    async function databaseEnums(): Promise<Record<string, string[]>> {
        const rows = await setup.query<{ name: string; values: string[] }>(
            `select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder)::text[] as values
             from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
             where n.nspname = 'main' group by t.typname`,
        )
        return Object.fromEntries(rows.map((row) => [row.name, row.values]))
    }

    async function collection(query = ''): Promise<EpicEnumsCollectionResponse['collection']> {
        const body = expectStatus(await setup.get<EpicEnumsCollectionResponse>(`/api/enums${query}`), 200)
        expect(Object.keys(body)).toEqual(['collection'])
        return body.collection
    }

    describe('GET /api/enums', () => {

        it('answers { collection } with every enum type of the database and its live values', async () => {
            const enums = await databaseEnums()

            const all = await collection()

            expect(all).toEqual(enums)
            expect(Object.keys(all).length).toBeGreaterThan(10)
        })

        it('names every member of EpicEnumName, and four more the shared type does not list (finding E2E-7)', async () => {
            const names = Object.keys(await collection())

            expect(Object.values(EpicEnumName).filter((name) => !names.includes(name))).toEqual([])
            expect(names.filter((name) => !(Object.values(EpicEnumName) as string[]).includes(name)).sort())
                .toEqual(['dutEntityName', 'moduleType', 'testResultStatus', 'userRole'])
        })

        it('filters by enumNames: one, several (repeated, comma-separated, bracketed)', async () => {
            const enums = await databaseEnums()
            const pair = { foundryName: enums['foundryName'], waferTech: enums['waferTech'] }

            expect(await collection('?enumNames=foundryName')).toEqual({ foundryName: enums['foundryName'] })
            expect(await collection('?enumNames=foundryName&enumNames=waferTech')).toEqual(pair)
            expect(await collection('?enumNames=foundryName,waferTech')).toEqual(pair)
            expect(await collection('?enumNames[]=foundryName&enumNames[]=waferTech')).toEqual(pair)
        })

        it('leaves unknown names out, and treats an empty enumNames as "all"', async () => {
            const enums = await databaseEnums()

            expect(await collection('?enumNames=foundryName&enumNames=noSuchEnum')).toEqual({ foundryName: enums['foundryName'] })
            expect(await collection('?enumNames=noSuchEnum')).toEqual({})
            expect(await collection('?enumNames=')).toEqual(enums)
        })

    })

})
