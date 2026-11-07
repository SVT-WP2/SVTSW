import { ApiProperty } from '@nestjs/swagger'
import { IsNumber } from 'class-validator'
import { EpicSvtTestSetupUpdateRequest } from 'epic-api-types'


export class EpicSvtTestSetupUpdateDto implements EpicSvtTestSetupUpdateRequest {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    defaultConfigId: number

}
