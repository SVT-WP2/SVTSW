import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { EpicChipCreateManyRequest, EpicChipCreateManyRequestItem } from 'svt-ts-types'


export class EpicChipCreateManyItemDto implements EpicChipCreateManyRequestItem {

    @IsString()
    @ApiProperty({ type: 'string' })
    serialNumber: string

    @IsNumber()
    @ApiProperty({ type: 'number' })
    asicId: number

}

export class EpicChipCreateManyRequestDto implements EpicChipCreateManyRequest {

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

