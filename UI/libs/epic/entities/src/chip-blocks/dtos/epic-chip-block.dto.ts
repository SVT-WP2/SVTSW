import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'

import { EpicChipBlockEntity } from '../models'


export class EpicChipBlockDto implements EpicChipBlockEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    chipId: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value chipBlockType' })
    chipBlockType: string

    @IsString()
    @ApiProperty({ type: 'string' })
    serialNumber: string

}
