import { ApiProperty } from '@nestjs/swagger'
import { IsNumber } from 'class-validator'

import { EpicSvtTestSetupUpdateEntity } from '../models'


export class EpicSvtTestSetupUpdateDto implements EpicSvtTestSetupUpdateEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    defaultConfigId: number

}
