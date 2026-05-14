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
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import {
    EpicWpMachineCreateRequestDto,
    EpicWpMachineDto,
    EpicWpMachineUpdateInstalledProbeCardDto,
    EpicWpMachineUpdateLoadedWaferDto,
    EpicWpMachineUpdateRequestDto,
    processKafkaReplyError,
} from 'epic/entities'
import { isNil } from 'lodash-es'
import { firstValueFrom } from 'rxjs'

import { EpicWpMachinesService } from '../services'


@Controller('/wp-machines')
export class EpicWpMachinesController {

    constructor(private readonly epicWpMachinesService: EpicWpMachinesService) {
    }

    @Get()
    @ApiResponse({ type: EpicWpMachineDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWpMachineDto })
    async getAll(): Promise<EpicWpMachineDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWpMachinesService.getAll())
        ))
    }

    @Get('/:id')
    @ApiResponse({ type: EpicWpMachineDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWpMachineDto })
    async getOne(@Param('id') id: number): Promise<EpicWpMachineDto> {
        const result = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicWpMachinesService.getAll(),
            )
        ))

        const entity = result?.find(item => item.id === +id)

        if (!entity) {
            throw new NotFoundException(`WpMachine does not exist: ${id}`)
        }

        return entity
    }

    @Post()
    @ApiBody({ type: EpicWpMachineCreateRequestDto })
    @ApiResponse({ type: EpicWpMachineDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWpMachineDto })
    async create(@Body() body: EpicWpMachineCreateRequestDto): Promise<EpicWpMachineDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWpMachinesService.create(body))
        ))
    }

    @Patch('/:id')
    @ApiBody({ type: EpicWpMachineUpdateRequestDto })
    @ApiResponse({ type: EpicWpMachineDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWpMachineDto })
    async update(@Param('id') id: number, @Body() body: EpicWpMachineUpdateRequestDto): Promise<EpicWpMachineDto> {
        const entity = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicWpMachinesService.update(+id, body),
            )
        ))

        if (!entity) {
            throw new NotFoundException(`Wafer does not exist: ${id}`)
        }

        return entity
    }

    @Post('/:id/loaded-wafer')
    @ApiBody({ type: EpicWpMachineUpdateLoadedWaferDto })
    @ApiResponse({ type: EpicWpMachineDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWpMachineDto })
    async updateLoadedWafer(@Param('id') id: number, @Body() body: EpicWpMachineUpdateLoadedWaferDto): Promise<EpicWpMachineDto> {
        const entity = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicWpMachinesService.updateLoadedWafer({
                    wpMachineId: +id,
                    loadedWaferId: !isNil(body.loadedWaferId) ? body.loadedWaferId : null,
                }),
            )
        ))

        if (!entity) {
            throw new NotFoundException(`Wafer does not exist: ${id}`)
        }

        return entity
    }

    @Post('/:id/installed-probe-card')
    @ApiBody({ type: EpicWpMachineUpdateInstalledProbeCardDto })
    @ApiResponse({ type: EpicWpMachineDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWpMachineDto })
    async updateInstalledProbeCard(
        @Param('id') id: number,
        @Body() body: EpicWpMachineUpdateInstalledProbeCardDto): Promise<EpicWpMachineDto> {

        const entity = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicWpMachinesService.updateInstalledProbeCard({
                    wpMachineId: +id,
                    installedProbeCardId: !isNil(body.installedProbeCardId) ? body.installedProbeCardId : null,
                }),
            )
        ))

        if (!entity) {
            throw new NotFoundException(`Wafer does not exist: ${id}`)
        }

        return entity
    }

}
