import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Get,
    NotFoundException,
    Param,
    Post,
    SerializeOptions,
    UseInterceptors,
} from '@nestjs/common'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import { EpicWpProjectCreateDto, EpicWpProjectDto, processKafkaReplyError } from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicWpProjectsService } from '../services'


@Controller('/wp-projects')
export class EpicWpProjectsController {

    constructor(private readonly epicWpProjectsService: EpicWpProjectsService) {
    }

    @Get()
    @ApiResponse({ type: EpicWpProjectDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWpProjectDto })
    async getAll(): Promise<EpicWpProjectDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWpProjectsService.getAll())
        ))
    }

    @Get('/:id')
    @ApiResponse({ type: EpicWpProjectDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWpProjectDto })
    async getOne(@Param('id') id: number): Promise<EpicWpProjectDto> {
        const result = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicWpProjectsService.getAll(),
            )
        ))

        const entity = result?.find(item => item.id === +id)

        if (!entity) {
            throw new NotFoundException(`WpProject does not exist: ${id}`)
        }

        return entity
    }

    @Post()
    @ApiBody({ type: EpicWpProjectCreateDto })
    @ApiResponse({ type: EpicWpProjectDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicWpProjectDto })
    async create(@Body() body: EpicWpProjectCreateDto): Promise<EpicWpProjectDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicWpProjectsService.create(body))
        ))
    }

}
