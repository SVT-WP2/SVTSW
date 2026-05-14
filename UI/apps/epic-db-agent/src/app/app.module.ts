import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { EpicDbAgentModule } from '../modules/db-agent'


@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: `.env.${process.env.NODE_ENV}`,
        }),
        EpicDbAgentModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
