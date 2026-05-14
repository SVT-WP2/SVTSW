import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

import { EpicSvtTestTemplateUpdateEntity } from '../models'


export class EpicSvtTestTemplateUpdateDto implements EpicSvtTestTemplateUpdateEntity {

    @IsBoolean()
    @ApiProperty({ type: 'boolean' })
    isEnabled: boolean

}

