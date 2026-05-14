import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional } from 'class-validator'


export class EpicWpMachineUpdateInstalledProbeCardDto {

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number', nullable: true })
    installedProbeCardId: number

}

