import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { EpicAsicsModule } from '../modules/asics'
import { EpicChipsModule } from '../modules/chips'
import { EpicEnumsModule } from '../modules/enums'
import { EpicEquipmentsModule } from '../modules/equipment'
import { HealthModule } from '../modules/health'
import { IvMntModule } from '../modules/iv-mnt'
import { EpicSvtTestModule } from '../modules/svt-test'
import { EpicTcpModule } from '../modules/tcp'
import { EpicWafersModule } from '../modules/wafers'
import { EpicWpModule } from '../modules/wp'


@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: `.env.${process.env.NODE_ENV}`,
        }),
        HealthModule,
        IvMntModule,
        EpicTcpModule,
        EpicWafersModule,
        EpicAsicsModule,
        EpicWpModule,
        EpicEnumsModule,
        EpicChipsModule,
        EpicEquipmentsModule,
        EpicSvtTestModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {
}
