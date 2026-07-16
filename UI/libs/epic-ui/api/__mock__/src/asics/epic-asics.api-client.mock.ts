import {
    EpicApiPager,
    EpicApiPageResponse,
    EpicAsic,
    EpicAsicCreate,
    EpicAsicsApiClient,
    EpicAsicsListQuery,
    getDefaultEpicApiPager,
} from 'epic-ui/api'
import { delay, Observable, of } from 'rxjs'


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
        queryFilter?: EpicAsicsListQuery.QueryFilter,
        pager?: Partial<EpicApiPager>): Observable<EpicApiPageResponse<EpicAsic>> {

        const filteredData = queryFilter
            ? this.asicsList.filter(item => {
                const fulfilWaferIdFilter = (queryFilter.waferId === item.waferId) || !queryFilter.waferId
                const fulfilAsicIdFilter = (queryFilter.asicId === item.id) || !queryFilter.asicId
                const fulfilFamilyTypeFilter = !queryFilter.familyTypes || (queryFilter.familyTypes.includes(item.familyType))
                const fulfilQualityTypeFilter = (queryFilter.quality === item.quality) || !queryFilter.quality
                return fulfilAsicIdFilter && fulfilWaferIdFilter && fulfilFamilyTypeFilter && fulfilQualityTypeFilter
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

    override create(createRequest: EpicAsicCreate): Observable<EpicAsic> {
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
