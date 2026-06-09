import { Body, ClassSerializerInterceptor, Controller, Get, Param, Post, Query, SerializeOptions, UseInterceptors } from '@nestjs/common'
import { NotFoundException } from '@nestjs/common/exceptions/not-found.exception'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import {
    EpicEquipmentCreateRequestDto,
    EpicEquipmentDto,
    EpicEquipmentGetAllParamsDto,
    EpicEquipmentLocationHistoryRecordDto,
    EpicEquipmentLocationUpdateRequestDto,
    processKafkaReplyError,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicEquipmentService } from '../services'


@Controller('/equipment')
export class EpicEquipmentController {

    constructor(private readonly epicEquipmentService: EpicEquipmentService) {
    }

    @Get()
    @SerializeOptions({ type: EpicEquipmentDto })
    @UseInterceptors(ClassSerializerInterceptor)
    // swagger
    @ApiResponse({ type: EpicEquipmentDto, isArray: true })
    async getAll(@Query() params: EpicEquipmentGetAllParamsDto): Promise<EpicEquipmentDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicEquipmentService.getAll(params))
        ))
    }

    @Post()
    @SerializeOptions({ type: EpicEquipmentDto })
    @UseInterceptors(ClassSerializerInterceptor)
    // swagger
    @ApiResponse({ type: EpicEquipmentDto })
    @ApiBody({ type: EpicEquipmentCreateRequestDto })
    create(@Body() body: EpicEquipmentCreateRequestDto): Promise<EpicEquipmentDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicEquipmentService.create(body))
        ))
    }


    @Post('/:equipmentId/location')
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicEquipmentDto })
    // swagger
    @ApiBody({ type: EpicEquipmentLocationUpdateRequestDto })
    @ApiResponse({ type: EpicEquipmentDto })
    async updateLocation(@Param('equipmentId') equipmentId: number, @Body() body: EpicEquipmentLocationUpdateRequestDto) {
        const equipment = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicEquipmentService.updateEquipmentLocation(
                    +equipmentId,
                    {
                        ...body,
                        username: null,
                    },
                ),
            )
        ))

        if (!equipment) {
            throw new NotFoundException(`Equipment does not exist: ${equipmentId}`)
        }

        return equipment
    }

    @Get('/:equipmentId/location-history')
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicEquipmentLocationHistoryRecordDto })
    //swagger
    @ApiResponse({ type: EpicEquipmentLocationHistoryRecordDto, isArray: true })
    async getLocationHistory(@Param('equipmentId') equipmentId: number): Promise<EpicEquipmentLocationHistoryRecordDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicEquipmentService.getEquipmentLocationHistory(+equipmentId))
        ))
    }

}
