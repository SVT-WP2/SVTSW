import { ApiProperty } from '@nestjs/swagger'
import { IsArray } from 'class-validator'

import { EpicPageDataDto } from '../../common'

import { EpicChipDto } from './epic-chip.dto'


export class EpicChipsListDto extends EpicPageDataDto<EpicChipDto> {

    @IsArray()
    @ApiProperty({ type: EpicChipDto, isArray: true })
    items: EpicChipDto[]

}
