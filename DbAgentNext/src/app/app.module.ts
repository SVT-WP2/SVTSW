import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { getSvtDbAgentNextConfigFactory, SvtDbAgentNextConfig, validateSvtDbAgentNextEnv } from '../config'
import { SVT_DB_ENTITIES } from '../db/data'
import { SvtDbOrmModule } from '../db/orm'
import { SvtDbAgentNextDispatchModule } from '../modules/dispatch'
import { SvtDbAgentNextHandlersModule } from '../modules/handlers'
import { SvtDbAgentNextHealthModule } from '../modules/health'
import { SvtDbAgentNextKafkaModule } from '../modules/kafka'


@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            // Resolved against the working directory: `npm start` and `node dist/main.js` run from DbAgentNext/,
            // where the committed `.env.<NODE_ENV>` files are. A container gets its variables from the environment.
            envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
            load: [getSvtDbAgentNextConfigFactory()],
            validate: validateSvtDbAgentNextEnv,
        }),
        SvtDbOrmModule.forRoot({
            useFactory: (configService: ConfigService<SvtDbAgentNextConfig, true>) => configService.get('database', { infer: true }),
            inject: [ConfigService],
            entities: SVT_DB_ENTITIES,
        }),
        SvtDbAgentNextDispatchModule,
        SvtDbAgentNextHandlersModule,
        SvtDbAgentNextKafkaModule,
        SvtDbAgentNextHealthModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {
}
