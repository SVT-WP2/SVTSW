import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'

import { EpicWpMachineCreateEntity } from '../models'


export class EpicWpMachineCreateRequestDto implements EpicWpMachineCreateEntity {

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsString()
    @ApiProperty({ type: 'string' })
    serialNumber: string

    @IsString()
    @ApiProperty({ type: 'string' })
    hostName: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value wpConnectionType' })
    connectionType: string

    @IsNumber()
    @ApiProperty({ type: 'number' })
    connectionPort: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value wpGeneralLocation' })
    generalLocation: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value wpSwType' })
    software: string

    @IsString()
    @ApiProperty({ type: 'string' })
    swVersion: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value wpVendor' })
    vendor: string

}

