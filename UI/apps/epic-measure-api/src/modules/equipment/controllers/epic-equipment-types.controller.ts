import { Body, ClassSerializerInterceptor, Controller, Get, Post, Query, SerializeOptions, UseInterceptors } from '@nestjs/common'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import {
    EpicEquipmentTypeCreateRequestDto,
    EpicEquipmentTypeDto,
    EpicEquipmentTypesGetAllParamsDto,
    processKafkaReplyError,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicEquipmentTypesService } from '../services'


@Controller('/equipment-types')
export class EpicEquipmentTypesController {

    constructor(private readonly epicEquipmentTypesService: EpicEquipmentTypesService) {
    }

    @Get()
    @SerializeOptions({ type: EpicEquipmentTypeDto })
    @UseInterceptors(ClassSerializerInterceptor)
    // swagger
    @ApiResponse({ type: EpicEquipmentTypeDto, isArray: true })
    async getAll(@Query() params: EpicEquipmentTypesGetAllParamsDto): Promise<EpicEquipmentTypeDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicEquipmentTypesService.getAll(params))
        ))
    }

    @Post()
    @SerializeOptions({ type: EpicEquipmentTypeDto })
    @UseInterceptors(ClassSerializerInterceptor)
    // swagger
    @ApiResponse({ type: EpicEquipmentTypeDto })
    @ApiBody({ type: EpicEquipmentTypeCreateRequestDto })
    create(@Body() body: EpicEquipmentTypeCreateRequestDto): Promise<EpicEquipmentTypeDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicEquipmentTypesService.create(body))
        ))
    }

}
