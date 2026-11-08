import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString } from 'class-validator'
import { EpicWpMachineUpdateLoadedWaferRequest } from 'svt-ts-types'


export class EpicWpMachineUpdateLoadedWaferDto implements EpicWpMachineUpdateLoadedWaferRequest {

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number', nullable: true })
    loadedWaferId: number | null

    /** Checked by the DB agent: a `waferMapOrientation` value, required to load (400 without it). */
    @IsString()
    @IsOptional()
    @ApiProperty({
        type: 'string',
        nullable: true,
        description: 'Enum value of waferMapOrientation; required to load a wafer, ignored when unloading',
    })
    loadedWaferOrientation: string | null

}
