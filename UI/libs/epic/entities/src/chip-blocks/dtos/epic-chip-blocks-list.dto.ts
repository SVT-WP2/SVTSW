import { ApiProperty } from '@nestjs/swagger'
import { IsArray } from 'class-validator'

import { EpicPageDataDto } from '../../common'

import { EpicChipBlockDto } from './epic-chip-block.dto'


export class EpicChipBlocksListDto extends EpicPageDataDto<EpicChipBlockDto> {

    @IsArray()
    @ApiProperty({ type: EpicChipBlockDto, isArray: true })
    items: EpicChipBlockDto[]

}
