import { Body, ClassSerializerInterceptor, Controller, Get, Param, Post, SerializeOptions, UseInterceptors } from '@nestjs/common'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import { EpicWaferDto, EpicWaferTypeCreateRequestDto, EpicWaferTypeDto, EpicWaferTypeMapDto, processKafkaReplyError } from 'epic/entities'
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
    @ApiResponse({ type: EpicWaferDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWaferDto })
    async getWaferTypeMap(@Param('waferTypeId') waferTypeId: number): Promise<EpicWaferTypeMapDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWaferTypesService.getWaferTypeMap(+waferTypeId))
        ))
    }

    // @ApiBody({ type: EpicWaferTypeUpdateRequestDto })
    // @Patch('/:id')
    // async update(@Param('id') id: number, @Body() body: EpicWaferTypeUpdateRequestDto) {
    //     const wafer = await firstValueFrom(this.epicWaferTypesService.update(+id, body))
    //
    //     if (!wafer) {
    //         throw new NotFoundException(`Wafer Type does not exist: ${id}`)
    //     }
    //
    //     return wafer
    // }

}
