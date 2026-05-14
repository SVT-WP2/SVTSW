import { Module } from '@nestjs/common'

import { IvMntGateway } from './iv-mnt.gateway'


@Module({
    providers: [IvMntGateway],
    exports: [IvMntGateway],
})
export class IvMntModule {
}
