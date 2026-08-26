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
import {
    EpicChipBlockDto,
    EpicChipBlocksGetAllParamsDto,
    EpicChipBlocksListDto,
    EpicPageDataDto,
    processKafkaReplyError,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicChipBlocksService } from '../services'


@Controller('/chip-blocks')
export class EpicChipBlocksController {

    constructor(private readonly epicChipBlocksService: EpicChipBlocksService) {
    }

    @Get()
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicPageDataDto<EpicChipBlockDto> })
    // swagger
    @ApiResponse({ type: EpicPageDataDto<EpicChipBlockDto> })
    async getAll(@Query() params: EpicChipBlocksGetAllParamsDto): Promise<EpicChipBlocksListDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicChipBlocksService.getAll(
                {
                    ids: params.ids?.length ? params.ids : undefined,
                    chipId: params.chipId ? +params.chipId : undefined,
                    chipBlockTypes: params.chipBlockTypes?.length ? params.chipBlockTypes : undefined,
                    serialNumber: params.serialNumber && !!params.serialNumber.length ? params.serialNumber : undefined,
                },
                {
                    limit: params.limit,
                    offset: params.offset,
                },
            ))
        ))
    }

    @Get('/:chipBlockId')
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicChipBlockDto })
    // swagger
    @ApiResponse({ type: EpicChipBlockDto })
    async getOne(@Param('chipBlockId') chipBlockId?: number): Promise<EpicChipBlockDto> {
        const list = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicChipBlocksService.getAll({ ids: chipBlockId ? [+chipBlockId] : undefined }),
            )
        ))
        const chipBlock = list.items.find(item => item.id === +chipBlockId)

        if (!chipBlock) {
            throw new NotFoundException(`ChipBlock does not exist: ${chipBlockId}`)
        }

        return chipBlock
    }

}
