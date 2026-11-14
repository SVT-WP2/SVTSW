import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'
import { EpicWaferType } from 'svt-ts-types'


export class EpicWaferTypeDto implements EpicWaferType {

    @ApiProperty({ type: 'number' })
    @IsNumber()
    id: number

    @ApiProperty({ type: 'string' })
    @IsString()
    name: string

    @ApiProperty({ type: 'string', description: 'Enum value engineeringRun' })
    @IsString()
    engineeringRun: string

    @ApiProperty({ type: 'string', description: 'Enum value foundryName' })
    @IsString()
    foundry: string

    @ApiProperty({ type: 'string', description: 'Enum value waferTech' })
    @IsString()
    technology: string

}
