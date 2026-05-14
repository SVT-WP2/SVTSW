import { Body, ClassSerializerInterceptor, Controller, Get, Param, Post, Query, SerializeOptions, UseInterceptors } from '@nestjs/common'
import { NotFoundException } from '@nestjs/common/exceptions/not-found.exception'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import {
    EpicChipCreateManyRequestDto,
    EpicChipCreateRequestDto,
    EpicChipDto,
    EpicChipLocationHistoryRecordDto,
    EpicChipLocationUpdateRequestDto,
    EpicChipsGetAllParamsDto,
    EpicChipsListDto,
    EpicPageDataDto,
    processKafkaReplyError,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicChipsService } from '../epic-chips.service'


@Controller('/chips')
export class EpicChipsController {

    constructor(private readonly epicChipsService: EpicChipsService) {
    }

    @Get()
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicPageDataDto<EpicChipDto> })
    // swagger
    @ApiResponse({ type: EpicPageDataDto<EpicChipDto> })
    async getAll(@Query() params: EpicChipsGetAllParamsDto): Promise<EpicChipsListDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicChipsService.getAll(
                {
                    ids: params.ids ? params.ids : undefined,
                    generalLocation: params.generalLocation ? params.generalLocation : undefined,
                    serialNumber: params.serialNumber && !!params.serialNumber.length ? params.serialNumber : undefined,
                },
                {
                    limit: params.limit,
                    offset: params.offset,
                },
            ))
        ))
    }

    @Get('/:chipId')
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicChipDto })
    // swagger
    @ApiResponse({ type: EpicChipDto })
    async getOne(@Param('chipId') chipId?: number): Promise<EpicChipDto> {
        const list = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicChipsService.getAll({ ids: chipId ? [+chipId] : undefined }),
            )
        ))
        const chip = list.items.find(item => item.id === +chipId)

        if (!chip) {
            throw new NotFoundException(`Chip does not exist: ${chipId}`)
        }

        return chip
    }

    @Post()
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicChipDto })
    // swagger
    @ApiBody({ type: EpicChipCreateRequestDto })
    @ApiResponse({ type: EpicChipDto })
    async create(@Body() body: EpicChipCreateRequestDto): Promise<EpicChipDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicChipsService.create(body))
        ))

    }

    @Post('create-many')
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicChipDto })
    // swagger
    @ApiBody({ type: EpicChipCreateManyRequestDto })
    @ApiResponse({ type: EpicChipDto, isArray: true })
    async createMany(@Body() body: EpicChipCreateManyRequestDto): Promise<EpicChipDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicChipsService.createMany(body))
        ))

    }

    @Post('/:chipId/location')
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicChipDto })
    // swagger
    @ApiBody({ type: EpicChipLocationUpdateRequestDto })
    @ApiResponse({ type: EpicChipDto })
    async updateLocation(@Param('chipId') chipId: number, @Body() body: EpicChipLocationUpdateRequestDto) {
        const chip = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicChipsService.updateChipLocation(
                    +chipId,
                    {
                        ...body,
                        username: null,
                    },
                ),
            )
        ))

        if (!chip) {
            throw new NotFoundException(`Chip does not exist: ${chipId}`)
        }

        return chip
    }

    @Get('/:chipId/location-history')
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicChipLocationHistoryRecordDto })
    //swagger
    @ApiResponse({ type: EpicChipLocationHistoryRecordDto, isArray: true })
    async getLocationHistory(@Param('chipId') chipId: number): Promise<EpicChipLocationHistoryRecordDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicChipsService.getChipLocationHistory(+chipId))
        ))
    }

}
