import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Get,
    NotFoundException,
    Param,
    Patch,
    Post,
    SerializeOptions,
    UseInterceptors,
} from '@nestjs/common'
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import {
    EpicWaferCreateRequestDto,
    EpicWaferDto,
    EpicWaferLocationHistoryRecordDto,
    EpicWaferLocationUpdateRequestDto,
    EpicWaferUpdateRequestDto,
    processKafkaReplyError,
    SvtDbAgentKafka,
    SvtDbAgentKafkaWafers,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicWafersService } from '../services'


@Controller('/wafers')
export class EpicWafersController {

    constructor(private readonly epicWafersService: EpicWafersService) {
    }

    @Get()
    @ApiResponse({ type: EpicWaferDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWaferDto })
    async getAll(): Promise<EpicWaferDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWafersService.getAll())
        ))
    }

    @Get('/:waferId')
    @ApiResponse({ type: EpicWaferDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWaferDto })
    async getOne(@Param('waferId') waferId: number): Promise<EpicWaferDto> {
        const result = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicWafersService.getAll({ ids: [+waferId] }),
            )
        ))

        const wafer = result?.find(item => item.id === +waferId)

        if (!wafer) {
            throw new NotFoundException(`Wafer does not exist: ${waferId}`)
        }

        return wafer
    }

    @Post()
    @ApiBody({ type: EpicWaferUpdateRequestDto })
    @ApiResponse({ type: EpicWaferDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWaferDto })
    create(@Body() body: EpicWaferCreateRequestDto): Promise<EpicWaferDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWafersService.create(body))
        ))
    }

    @Patch('/:waferId')
    @ApiBody({ type: EpicWaferUpdateRequestDto })
    async update(@Param('waferId') waferId: number, @Body() body: EpicWaferUpdateRequestDto) {
        const wafer = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicWafersService.update(+waferId, body),
            )
        ))

        if (!wafer) {
            throw new NotFoundException(`Wafer does not exist: ${waferId}`)
        }

        return wafer
    }

    @Post('/:waferId/location')
    @ApiBody({ type: EpicWaferLocationUpdateRequestDto })
    async updateLocation(@Param('waferId') waferId: number, @Body() body: EpicWaferLocationUpdateRequestDto) {
        const wafer = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicWafersService.updateWaferLocation(
                    +waferId,
                    {
                        ...body,
                        username: null,
                    },
                ),
            )
        ))

        if (!wafer) {
            throw new NotFoundException(`Wafer does not exist: ${waferId}`)
        }

        return wafer
    }

    @Get('/:waferId/location-history')
    @ApiResponse({ type: EpicWaferLocationHistoryRecordDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWaferLocationHistoryRecordDto })
    async getLocationHistory(@Param('waferId') waferId: number): Promise<EpicWaferLocationHistoryRecordDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWafersService.getWaferLocationHistory(+waferId))
        ))
    }

    @EventPattern(SvtDbAgentKafka.TopicName.Request)
    handleDbRequest(@Payload() message: SvtDbAgentKafkaWafers.Message, @Ctx() context: KafkaContext) {
        const { headers } = context.getMessage()
        console.log(
            `[${new Date().toUTCString()}] MESSAGE :: ${SvtDbAgentKafka.TopicName.Request}`,
            JSON.stringify(headers, null, 4),
            JSON.stringify(message, null, 4),
        )

    }

    @EventPattern(SvtDbAgentKafka.TopicName.RequestReply)
    handleDbRequestReply(@Payload() message: SvtDbAgentKafkaWafers.ReplyMessage, @Ctx() context: KafkaContext) {
        const { headers } = context.getMessage()
        console.log(
            `[${new Date().toUTCString()}] MESSAGE :: ${SvtDbAgentKafka.TopicName.RequestReply}`,
            JSON.stringify(headers, null, 4),
            // JSON.stringify(message, null, 4),
        )
    }

}
