import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { getSvtDbAgentNextConfigFactory, validateSvtDbAgentNextEnv } from '../config'
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
        SvtDbAgentNextHealthModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {
}
