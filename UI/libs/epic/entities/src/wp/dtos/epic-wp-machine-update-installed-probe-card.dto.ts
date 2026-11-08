import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString } from 'class-validator'
import { EpicWpMachineUpdateInstalledProbeCardRequest } from 'svt-ts-types'


export class EpicWpMachineUpdateInstalledProbeCardDto implements EpicWpMachineUpdateInstalledProbeCardRequest {

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number', nullable: true })
    installedProbeCardId: number | null

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string', nullable: true, required: false, description: 'Enum value of waferMapOrientation; optional' })
    installedProbeCardOrientation?: string | null

}
