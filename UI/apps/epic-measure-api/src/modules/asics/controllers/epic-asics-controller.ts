import { Body, ClassSerializerInterceptor, Controller, Get, Param, Post, Query, SerializeOptions, UseInterceptors } from '@nestjs/common'
import { NotFoundException } from '@nestjs/common/exceptions/not-found.exception'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import {
    EpicAsicCreateRequestDto,
    EpicAsicDto,
    EpicAsicsGetAllParamsDto,
    EpicAsicsListDto,
    EpicPageDataDto,
    processKafkaReplyError,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicAsicsService } from '../epic-asics.service'


@Controller('/asics')
export class EpicAsicsController {

    constructor(private readonly epicAsicsService: EpicAsicsService) {
    }

    @Get()
    @ApiResponse({ type: EpicPageDataDto<EpicAsicDto> })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicPageDataDto<EpicAsicDto> })
    async getAll(@Query() params: EpicAsicsGetAllParamsDto): Promise<EpicAsicsListDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicAsicsService.getAll(
                {
                    waferId: params.waferId ? +params.waferId : undefined,
                    chipId: params.chipId ? +params.chipId : undefined,
                    familyType: params.asicFamilyType ? params.asicFamilyType : undefined,
                    quality: params.asicQuality ? params.asicQuality : undefined,
                    serialNumber: params.serialNumber && !!params.serialNumber.length ? params.serialNumber : undefined,
                },
                {
                    limit: params.limit,
                    offset: params.offset,
                },
            ))
        ))
    }

    @Get('/:asicId')
    @ApiResponse({ type: EpicAsicDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicAsicDto })
    async getOne(@Param('asicId') asicId?: number): Promise<EpicAsicDto> {
        const list = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicAsicsService.getAll({ ids: asicId ? [+asicId] : undefined }),
            )
        ))
        const asic = list.items.find(item => item.id === +asicId)

        if (!asic) {
            throw new NotFoundException(`Asic does not exist: ${asicId}`)
        }

        return asic
    }

    @Post()
    @ApiBody({ type: EpicAsicCreateRequestDto })
    @ApiResponse({ type: EpicAsicDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicAsicDto })
    async create(@Body() body: EpicAsicCreateRequestDto): Promise<EpicAsicDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicAsicsService.create(body))
        ))

    }

}
