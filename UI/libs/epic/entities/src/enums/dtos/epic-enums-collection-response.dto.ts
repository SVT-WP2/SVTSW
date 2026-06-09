import { ApiProperty } from '@nestjs/swagger'
import { IsObject } from 'class-validator'

import { EpicApiEnumsCollection } from '../models'


export class EpicEnumsCollectionResponseDto {

    @ApiProperty()
    @IsObject()
    collection: Partial<EpicApiEnumsCollection>

}
