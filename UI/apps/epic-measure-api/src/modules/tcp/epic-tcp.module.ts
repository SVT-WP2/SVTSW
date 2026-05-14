import { Module } from '@nestjs/common'

import { EpicTcpController } from './epic-tcp-controller'
import { EpicTcpService } from './epic-tcp.service'


@Module({
    providers: [EpicTcpService],
    controllers: [EpicTcpController],
})
export class EpicTcpModule {}
