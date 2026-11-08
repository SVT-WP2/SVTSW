import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNumber } from 'class-validator'
import { EpicApiPageResponse } from 'svt-ts-types'


export class EpicPageDataDto<T> implements EpicApiPageResponse<T> {

    @IsArray()
    @ApiProperty({ type: 'array', isArray: true })
    items: T[]

    @IsNumber()
    @ApiProperty({ type: 'number' })
    totalCount: number

}
