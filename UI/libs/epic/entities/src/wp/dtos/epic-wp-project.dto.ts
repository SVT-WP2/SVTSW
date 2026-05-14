import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'

import { EpicWpProjectEntity } from '../models'


export class EpicWpProjectDto implements EpicWpProjectEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    wpMachineId: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    waferTypeId: number

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value asicFamilyType' })
    asicFamilyType: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value waferMapOrientation' })
    orientation: string

    @IsString()
    @ApiProperty({ type: 'string' })
    alignmentDie: string

    @IsString()
    @ApiProperty({ type: 'string' })
    homeDie: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Stringified JSON' })
    local2GlobalMap: string

}
