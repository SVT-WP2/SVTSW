import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Get,
    NotFoundException,
    Param, Patch,
    Post,
    SerializeOptions,
    UseInterceptors,
} from '@nestjs/common'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import { EpicSvtTestSetupCreateDto, EpicSvtTestSetupDto, EpicSvtTestSetupUpdateDto, processKafkaReplyError } from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicSvtTestSetupsService } from '../services'


@Controller('/svt-test-setups')
export class EpicSvtTestSetupsController {

    constructor(private readonly epicSvtTestSetupsService: EpicSvtTestSetupsService) {
    }

    @Get()
    @ApiResponse({ type: EpicSvtTestSetupDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestSetupDto })
    async getAll(): Promise<EpicSvtTestSetupDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestSetupsService.getAll())
        ))
    }

    @Get('/:id')
    @ApiResponse({ type: EpicSvtTestSetupDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestSetupDto })
    async getOne(@Param('id') id: number): Promise<EpicSvtTestSetupDto> {
        const result = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicSvtTestSetupsService.getAll({ ids: [+id] }),
            )
        ))

        const entity = result?.find(item => item.id === +id)

        if (!entity) {
            throw new NotFoundException(`SvtTestSetup does not exist: ${id}`)
        }

        return entity
    }

    @Post()
    @ApiBody({ type: EpicSvtTestSetupCreateDto })
    @ApiResponse({ type: EpicSvtTestSetupDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestSetupDto })
    async create(@Body() body: EpicSvtTestSetupCreateDto): Promise<EpicSvtTestSetupDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestSetupsService.create(body))
        ))
    }

    @Patch('/:id')
    @ApiBody({ type: EpicSvtTestSetupUpdateDto })
    @ApiResponse({ type: EpicSvtTestSetupDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestSetupDto })
    async update(@Param('id') id: number, @Body() body: EpicSvtTestSetupUpdateDto): Promise<EpicSvtTestSetupDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestSetupsService.update(+id, body))
        ))
    }

}
