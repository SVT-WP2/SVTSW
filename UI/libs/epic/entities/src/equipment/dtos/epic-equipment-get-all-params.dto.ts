import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional } from 'class-validator'


export class EpicEquipmentGetAllParamsDto {

    @IsNumber({}, { each: true })
    @IsOptional()
    // swagger
    @ApiProperty({ type: 'number', isArray: true })
    ids: number[]

}
