import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional } from 'class-validator'
import { EpicWpMachineUpdateLoadedWaferRequest } from 'epic-api-types'


export class EpicWpMachineUpdateLoadedWaferDto implements EpicWpMachineUpdateLoadedWaferRequest {

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number', nullable: true })
    loadedWaferId: number | null

}
