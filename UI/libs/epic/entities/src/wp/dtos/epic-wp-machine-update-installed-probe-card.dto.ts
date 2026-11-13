import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional } from 'class-validator'
import { EpicWpMachineUpdateInstalledProbeCardRequest } from 'epic-api-types'


export class EpicWpMachineUpdateInstalledProbeCardDto implements EpicWpMachineUpdateInstalledProbeCardRequest {

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number', nullable: true })
    installedProbeCardId: number | null

}
