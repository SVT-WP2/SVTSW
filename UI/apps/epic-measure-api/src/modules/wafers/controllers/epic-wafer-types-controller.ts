import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    SerializeOptions,
    UseInterceptors,
} from '@nestjs/common'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import { EpicWaferTypeCreateRequestDto, EpicWaferTypeDto, EpicWaferTypeMapDto, processKafkaReplyError } from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicWaferTypesService } from '../services'


@Controller('/wafer-types')
export class EpicWaferTypesController {

    constructor(private readonly epicWaferTypesService: EpicWaferTypesService) {
    }

    @Get()
    @ApiResponse({ type: EpicWaferTypeDto, isArray: true })
    @SerializeOptions({ type: EpicWaferTypeDto })
    @UseInterceptors(ClassSerializerInterceptor)
    async getAll(): Promise<EpicWaferTypeDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWaferTypesService.getAll())
        ))
    }

    @Post()
    @ApiResponse({ type: EpicWaferTypeDto })
    @ApiBody({ type: EpicWaferTypeCreateRequestDto })
    @SerializeOptions({ type: EpicWaferTypeDto })
    @UseInterceptors(ClassSerializerInterceptor)
    create(@Body() body: EpicWaferTypeCreateRequestDto): Promise<EpicWaferTypeDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWaferTypesService.create(body))
        ))
    }

    @Get('/:waferTypeId/wafer-map')
    @ApiResponse({ type: EpicWaferTypeMapDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWaferTypeMapDto })
    async getWaferTypeMap(@Param('waferTypeId', ParseIntPipe) waferTypeId: number): Promise<EpicWaferTypeMapDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWaferTypesService.getWaferTypeMap(+waferTypeId))
        ))
    }

}
