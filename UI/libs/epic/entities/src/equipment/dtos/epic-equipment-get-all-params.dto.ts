import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional } from 'class-validator'
import { EpicEquipmentListQuery } from 'epic-api-types'


export class EpicEquipmentGetAllParamsDto implements EpicEquipmentListQuery {

    @IsNumber({}, { each: true })
    @IsOptional()
    @ApiProperty({ type: 'number', isArray: true, required: false })
    ids?: number[]

}
