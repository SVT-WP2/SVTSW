import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional } from 'class-validator'


export class EpicWpMachineUpdateLoadedWaferDto {

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number', nullable: true })
    loadedWaferId: number

}

