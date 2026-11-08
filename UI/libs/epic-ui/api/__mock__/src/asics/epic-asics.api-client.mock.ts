import { EpicAsicsApiClient, getDefaultEpicApiPager } from 'epic-ui/api'
import { delay, Observable, of } from 'rxjs'
import { EpicApiPager, EpicApiPageResponse, EpicAsic, EpicAsicCreateRequest, EpicAsicsListQuery } from 'svt-ts-types'


import { EpicEnumsMock } from '../enums'


export function generateAsics(waferId: number, totalCount: number, idStartsFrom = 1): EpicAsic[] {
    const result: EpicAsic[] = []

    for (let i = idStartsFrom; i <= idStartsFrom + totalCount; i++) {
        result.push({
            id: i,
            serialNumber: `asic-${i}`,
            waferId,
            chipId: Math.random() > 0.5 ? i : null,
            familyType: 'Ancillary',
            waferMapPosition: `${i + 1}`,
            quality: EpicEnumsMock.getEnumsCollection().asicQuality[1],
        })
    }

    return result

}

export class EpicAsicsApiClientMock extends EpicAsicsApiClient {

    protected asicsList = [
        ...generateAsics(1, 80 * 1000, 1),
        ...generateAsics(2, 80 * 1000, 800 * 1000 + 2),
    ]

    override fetchAsicsList(
        queryFilter?: EpicAsicsListQuery,
        pager?: Partial<EpicApiPager>): Observable<EpicApiPageResponse<EpicAsic>> {

        const filteredData = queryFilter
            ? this.asicsList.filter(item => {
                const fulfilWaferIdFilter = (queryFilter.waferId === item.waferId) || !queryFilter.waferId
                const fulfilChipIdFilter = (queryFilter.chipId === item.chipId) || !queryFilter.chipId
                const fulfilFamilyTypeFilter = !queryFilter.asicFamilyTypes?.length
                    || queryFilter.asicFamilyTypes.includes(item.familyType)
                const fulfilQualityFilter = (queryFilter.asicQuality === item.quality) || !queryFilter.asicQuality
                const fulfilSerialNumberFilter = !queryFilter.serialNumber || item.serialNumber.includes(queryFilter.serialNumber)
                return fulfilChipIdFilter
                    && fulfilWaferIdFilter
                    && fulfilFamilyTypeFilter
                    && fulfilQualityFilter
                    && fulfilSerialNumberFilter
            })
            : this.asicsList

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

    override create(createRequest: EpicAsicCreateRequest): Observable<EpicAsic> {
        const newEntity: EpicAsic = {
            ...createRequest,
            id: this.asicsList.length ? this.asicsList[this.asicsList.length - 1].id + 1 : 1,
        }
        this.asicsList.push(newEntity)
        return of(newEntity)
            .pipe(
                delay(500),
            )
    }

    override fetchOne(asicId: number): Observable<EpicAsic> {
        const refWafer = this.asicsList.find(item => item.id === asicId)!
        return of(refWafer)
            .pipe(
                delay(500),
            )
    }

}
