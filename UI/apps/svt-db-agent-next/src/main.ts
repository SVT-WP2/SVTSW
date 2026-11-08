import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app'
import { getSvtDbAgentNextLogLevels, SvtDbAgentNextConfig } from './config'


async function bootstrap() {
    // The log levels are needed before the ConfigModule has validated the environment, hence the raw read;
    // the validated value is applied again once the application exists.
    const app = await NestFactory.create(AppModule, {
        logger: getSvtDbAgentNextLogLevels(process.env.SVT_DB_AGENT_LOGGER_TERM_VERBOSITY),
    })
    const configService = app.get(ConfigService<SvtDbAgentNextConfig, true>)
    app.useLogger(configService.get('logLevels', { infer: true }))
    app.enableShutdownHooks()

    // Phase 4 connects the Kafka microservice here (`connectMicroservice` + `startAllMicroservices`).

    const httpPort = configService.get('httpPort', { infer: true })
    await app.listen(httpPort)
    Logger.log(`🚀 SvtDbAgentNext is running on: http://localhost:${httpPort} (GET /health)`)
}

void bootstrap()
