import { ClassSerializerInterceptor, Controller, Get, NotFoundException, Param, SerializeOptions, UseInterceptors } from '@nestjs/common'
import { ApiResponse } from '@nestjs/swagger'
import { EpicWpProbeCardDto, processKafkaReplyError } from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicWpProbeCardsService } from '../services'


@Controller('/wp-probe-cards')
export class EpicWpProbeCardsController {

    constructor(private readonly epicWpProbeCardsService: EpicWpProbeCardsService) {
    }

    @Get()
    @ApiResponse({ type: EpicWpProbeCardDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWpProbeCardDto })
    async getAll(): Promise<EpicWpProbeCardDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWpProbeCardsService.getAll())
        ))
    }

    @Get('/:id')
    @ApiResponse({ type: EpicWpProbeCardDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWpProbeCardDto })
    async getOne(@Param('id') id: number): Promise<EpicWpProbeCardDto> {
        const result = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicWpProbeCardsService.getAll(),
            )
        ))

        const entity = result?.find(item => item.id === +id)

        if (!entity) {
            throw new NotFoundException(`WpProbeCard does not exist: ${id}`)
        }

        return entity
    }

}
