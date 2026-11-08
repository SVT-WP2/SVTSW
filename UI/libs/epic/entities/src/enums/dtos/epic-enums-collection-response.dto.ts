import { ApiProperty } from '@nestjs/swagger'
import { IsObject } from 'class-validator'
import { EpicEnumsCollectionResponse } from 'svt-ts-types'
import { EpicApiEnumsCollection } from 'svt-ts-types/kafka'


export class EpicEnumsCollectionResponseDto implements EpicEnumsCollectionResponse {

    @ApiProperty()
    @IsObject()
    collection: Partial<EpicApiEnumsCollection>

}
