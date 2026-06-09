import {
    EpicApiPager,
    EpicApiPageResponse,
    EpicChip, EpicChipCreate, EpicChipCreateMany,
    EpicChipLocation, EpicChipLocationUpdate,
    EpicChipsApiClient,
    EpicChipsListQuery,
    getDefaultEpicApiPager,
} from 'epic-ui/api'
import { concat, delay, Observable, of, zipAll } from 'rxjs'

import { EpicEnumsMock } from '../enums'


export class EpicChipsApiClientMock extends EpicChipsApiClient {

    protected entities = [
        ...generateMockChips(100 * 1000, 1),
    ]

    protected chipsLocationHistory: { [chipId: string]: EpicChipLocation[] } = {}

    override fetchChipsList(
        queryFilter?: EpicChipsListQuery.QueryFilter,
        pager?: Partial<EpicApiPager>): Observable<EpicApiPageResponse<EpicChip>> {

        const filteredData = queryFilter
            ? this.entities.filter(item => {
                const fulfilSerialNumberFilter = !queryFilter.serialNumber
                    || (item.serialNumber.toLowerCase().includes(queryFilter.serialNumber.toLowerCase()))
                const fulfilChipIdFilter = !queryFilter.chipId || (queryFilter.chipId === item.id)
                const fulfilGeneralLocationFilter = !queryFilter.generalLocation || (queryFilter.generalLocation === item.generalLocation)
                return fulfilSerialNumberFilter && fulfilGeneralLocationFilter && fulfilChipIdFilter
            })
            : this.entities

        const pagerDto = { ...getDefaultEpicApiPager(), ...(pager || {}) }

        const pageData = pagerDto
            ? filteredData.slice(pagerDto.offset, pagerDto.offset + pagerDto.limit)
            : filteredData

        return of({
            items: pageData,
            totalCount: filteredData.length,
        })
            .pipe(
                delay(500),
            )
    }

    override create(payload: EpicChipCreate): Observable<EpicChip> {
        const newEntity: EpicChip = {
            id: this.entities.length ? this.entities[this.entities.length - 1].id + 1 : 1,
            generalLocation: payload.generalLocation,
            serialNumber: payload.serialNumber,
        }
        this.entities.push(newEntity)

        return of(newEntity)
            .pipe(
                delay(500),
            )
    }

    override createMany(payload: EpicChipCreateMany): Observable<EpicChip[]> {
        return concat(
            payload.items
                .map(
                    item => this.create({ generalLocation: payload.generalLocation, ...item }),
                ),
        )
            .pipe(
                zipAll(),
            )
    }

    override fetchOne(chipId: number): Observable<EpicChip> {
        const refEntity = this.entities.find(item => item.id === chipId)!
        return of(refEntity)
            .pipe(
                delay(500),
            )
    }

    override fetchChipLocationHistory(chipId: number): Observable<EpicChipLocation[]> {
        return of(this.chipsLocationHistory[chipId] ?? [])
            .pipe(
                delay(500),
            )
    }

    override updateChipLocation(chipId: number, update: EpicChipLocationUpdate): Observable<EpicChip> {
        this.chipsLocationHistory[chipId] = [
            ...(this.chipsLocationHistory[chipId] ?? []),
            {
                ...update,
                chipId,
            },
        ]

        return this.updateChip(chipId, { generalLocation: update.generalLocation })
    }

    updateChip(chipId: number, updateRequest: Partial<Omit<EpicChip, 'id'>>): Observable<EpicChip> {
        let refChip: EpicChip

        this.entities = this.entities
            .map(item => {
                if (item.id === chipId) {
                    refChip = {
                        ...item,
                        ...updateRequest,
                    }
                    return refChip
                }
                return item
            })

        return of(refChip!)
            .pipe(
                delay(50),
            )
    }

}

export function generateMockChips(totalCount: number, idStartsFrom = 0): EpicChip[] {
    const result: EpicChip[] = []

    for (let i = idStartsFrom; i <= idStartsFrom + totalCount; i++) {
        result.push({
            id: i,
            serialNumber: `chip-${i}`,
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[Math.random() > 0.5 ? 0 : 1],
        })
    }

    return result

}
