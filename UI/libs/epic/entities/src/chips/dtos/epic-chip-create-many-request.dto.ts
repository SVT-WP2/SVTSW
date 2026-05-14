import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

import { EpicChipCreateManyEntity, EpicChipCreateManyItemEntity } from '../models'


export class EpicChipCreateManyItemDto implements EpicChipCreateManyItemEntity {

    @IsString()
    @ApiProperty({ type: 'string' })
    serialNumber: string

    @IsNumber()
    @ApiProperty({ type: 'number' })
    asicId: number

}

export class EpicChipCreateManyRequestDto implements EpicChipCreateManyEntity {

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value generalLocation' })
    generalLocation: string

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => EpicChipCreateManyItemDto)
    @ApiProperty({ isArray: true, type: EpicChipCreateManyItemDto })
    items: EpicChipCreateManyItemDto[]

}

