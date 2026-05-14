import { Body, Controller, InternalServerErrorException, Post } from '@nestjs/common'

import { EpicTcpReadMessageDto, EpicTcpSendMessageDto } from './dtos'
import { EpicTcpService } from './epic-tcp.service'


@Controller('/tcp')
export class EpicTcpController {

    constructor(private readonly epicTcpService: EpicTcpService) {
    }

    @Post('send-and-read')
    async sendAndRead(@Body() body: EpicTcpSendMessageDto) {
        try {
            return await this.epicTcpService.sendAndReadMessage(body.ipAddress, body.portNumber, body.message)
        }
        catch (error) {
            throw new InternalServerErrorException(error.message)
        }
    }

    @Post('send')
    async send(@Body() body: EpicTcpSendMessageDto) {
        try {
            return await this.epicTcpService.sendMessage(body.ipAddress, body.portNumber, body.message)
        }
        catch (error) {
            throw new InternalServerErrorException(error.message)
        }
    }

    @Post('read')
    async read(@Body() body: EpicTcpReadMessageDto){
        try {
            return await this.epicTcpService.readMessage(body.ipAddress, body.portNumber)
        }
        catch (error) {
            throw new InternalServerErrorException(error.message)
        }
    }

}
