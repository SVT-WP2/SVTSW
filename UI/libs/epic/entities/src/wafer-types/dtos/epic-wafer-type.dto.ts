import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'


export class EpicWaferTypeDto {

    @ApiProperty({ type: 'number' })
    @IsNumber()
    id: number

    @ApiProperty({ type: 'string' })
    @IsString()
    name: string

    @ApiProperty({ type: 'string' })
    @IsString()
    engineeringRun: string

    @ApiProperty({ type: 'string' })
    @IsString()
    foundry: string

    @ApiProperty({ type: 'string' })
    @IsString()
    technology: string

}

