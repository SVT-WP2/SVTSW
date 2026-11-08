import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { SVT_DB_ENTITIES } from 'svt-db/data'
import { SvtDbOrmModule } from 'svt-db/orm'

import { getSvtDbAgentNextConfigFactory, SvtDbAgentNextConfig, validateSvtDbAgentNextEnv } from '../config'
import { SvtDbAgentNextHealthModule } from '../modules/health'


@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            // Resolved against the working directory, as in the other apps. Under `nx serve` Nx has already
            // loaded `apps/svt-db-agent-next/.env.<configuration>` into the environment before this runs.
            envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
            load: [getSvtDbAgentNextConfigFactory()],
            validate: validateSvtDbAgentNextEnv,
        }),
        SvtDbOrmModule.forRoot({
            useFactory: (configService: ConfigService<SvtDbAgentNextConfig, true>) => configService.get('database', { infer: true }),
            inject: [ConfigService],
            entities: SVT_DB_ENTITIES,
        }),
        SvtDbAgentNextHealthModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {
}
