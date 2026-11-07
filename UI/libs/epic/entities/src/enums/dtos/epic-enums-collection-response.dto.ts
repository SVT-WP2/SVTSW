import { ApiProperty } from '@nestjs/swagger'
import { IsObject } from 'class-validator'
import { EpicEnumsCollectionResponse } from 'epic-api-types'

import { EpicApiEnumsCollection } from '../models'


export class EpicEnumsCollectionResponseDto implements EpicEnumsCollectionResponse {

    @ApiProperty()
    @IsObject()
    collection: Partial<EpicApiEnumsCollection>

}
