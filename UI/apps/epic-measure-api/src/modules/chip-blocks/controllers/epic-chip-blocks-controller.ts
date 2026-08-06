import {
    ClassSerializerInterceptor,
    Controller,
    Get,
    NotFoundException,
    Param,
    Query,
    SerializeOptions,
    UseInterceptors,
} from '@nestjs/common'
import { ApiResponse } from '@nestjs/swagger'
import { EpicChipBlockDto, EpicChipBlocksGetAllParamsDto, processKafkaReplyError } from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicChipBlocksService } from '../services'


@Controller('/chip-blocks')
export class EpicChipBlocksController {

    constructor(private readonly epicChipBlocksService: EpicChipBlocksService) {
    }

    @Get()
    @ApiResponse({ type: EpicChipBlockDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicChipBlockDto })
    async getAll(@Query() params: EpicChipBlocksGetAllParamsDto): Promise<EpicChipBlockDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicChipBlocksService.getAll({
                ids: params.ids?.length ? params.ids : undefined,
                chipId: params.chipId ? params.chipId : undefined,
                blockTypes: params.blockTypes?.length ? params.blockTypes : undefined,
            }))
        ))
    }

    @Get('/:id')
    @ApiResponse({ type: EpicChipBlockDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicChipBlockDto })
    async getOne(@Param('id') id: number): Promise<EpicChipBlockDto> {
        const result = await processKafkaReplyError(() => (
            firstValueFrom(this.epicChipBlocksService.getAll({ ids: [+id] }))
        ))

        const entity = result?.find(item => item.id === +id)

        if (!entity) {
            throw new NotFoundException(`ChipBlock does not exist: ${id}`)
        }

        return entity
    }

}
