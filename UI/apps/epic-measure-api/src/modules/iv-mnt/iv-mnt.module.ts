import { Module } from '@nestjs/common'

import { EpicAuthModule } from '../auth'

import { IvMntGateway } from './iv-mnt.gateway'


@Module({
    imports: [EpicAuthModule],
    providers: [IvMntGateway],
    exports: [IvMntGateway],
})
export class IvMntModule {
}
