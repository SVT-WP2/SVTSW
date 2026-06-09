import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'

import { EpicWpMachineUpdateEntity } from '../models'


export class EpicWpMachineUpdateRequestDto implements EpicWpMachineUpdateEntity {

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

}

