import { Injectable } from '@nestjs/common'
import { delay, map, Observable, of, switchMap, tap, throwError } from 'rxjs'
import { EpicApiPager, EpicApiPageResponse, EpicAsic, EpicAsicCreateRequest } from 'svt-ts-types'
import { EpicGetAllAsicsQueryFilter } from 'svt-ts-types/kafka'

import { getEnumsCollection } from './epic-db-agent-enums.service'
import { EpicDbAgentWafersService } from './epic-db-agent-wafers.service'


@Injectable()
export class EpicDbAgentAsicsService {

    protected asics: EpicAsic[] = [
        ...generateAsics(1, 80 * 1000, 1),
        ...generateAsics(2, 80 * 1000, 800 * 1000 + 2),
    ]


    constructor(private readonly epicDbAgentWafersService: EpicDbAgentWafersService) {
    }

    getAllAsics(queryFilter?: EpicGetAllAsicsQueryFilter, pager?: EpicApiPager ): Observable<EpicApiPageResponse<EpicAsic>> {
        const filteredData = queryFilter
            ? this.asics.filter(item => {
                const fulfilWaferIdFilter = !queryFilter.waferId || (queryFilter.waferId === item.waferId)
                const fulfilAsicIdFilter = !queryFilter.ids?.length || (queryFilter.ids.includes(item.id))
                const fulfilChipIdFilter = !queryFilter.chipId || (queryFilter.chipId === item.chipId)
                const fulfilFamilyTypeFilter = !queryFilter.familyTypes || (queryFilter.familyTypes.includes(item.familyType))
                const fulfilQualityTypeFilter = !queryFilter.quality || (queryFilter.quality === item.quality)
                const fulfilSerialNumberFilter = !queryFilter.serialNumber || (item.serialNumber.includes(queryFilter.serialNumber))

                return fulfilAsicIdFilter
                    && fulfilChipIdFilter
                    && fulfilWaferIdFilter
                    && fulfilFamilyTypeFilter
                    && fulfilQualityTypeFilter
                    && fulfilSerialNumberFilter
            })
            : this.asics

        const pageData = pager
            ? filteredData.slice(pager.offset, pager.offset + pager.limit)
            : filteredData

        return of({
            items: pageData,
            totalCount: filteredData.length,
        })
            .pipe(
                delay(50),
            )
    }

    createAsic(createRequest: EpicAsicCreateRequest): Observable<EpicAsic> {

        const newEntity: EpicAsic = {
            id: (this.asics[this.asics.length - 1]?.id || 0) + 1,
            ...createRequest,
        }

        return this.decorateAsic(newEntity)
            .pipe(
                tap((asic) => this.asics.push(asic)),
                delay(50),
            )
    }

    protected decorateAsic(base: EpicAsic): Observable<EpicAsic> {
        return this.epicDbAgentWafersService.getWaferById(base.waferId)
            .pipe(
                switchMap(wafer =>
                    wafer
                        ? of(wafer)
                        : throwError(() => new Error(`Wafer does not exist, waferId: ${base.waferId}`))),
                map((wafer) => ({
                    ...base,
                })),
            )
    }

}

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
            quality: getEnumsCollection().asicQuality[1],
        })
    }

    return result

}
