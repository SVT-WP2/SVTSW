import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app'
import { getSvtDbAgentNextLogLevels, SvtDbAgentNextConfig } from './config'
import { buildSvtDbAgentNextKafkaOptions, SvtDbAgentNextHeartbeatService } from './modules/kafka'


async function bootstrap() {
    // The log levels are needed before the ConfigModule has validated the environment, hence the raw read;
    // the validated value is applied again once the application exists.
    const app = await NestFactory.create(AppModule, {
        logger: getSvtDbAgentNextLogLevels(process.env.SVT_DB_AGENT_LOGGER_TERM_VERBOSITY),
    })
    const configService = app.get(ConfigService<SvtDbAgentNextConfig, true>)
    app.useLogger(configService.get('logLevels', { infer: true }))
    app.enableShutdownHooks()

    // The Kafka consumer (`svt.db-agent.request`) and the heartbeat; an unreachable broker ends the boot, as it
    // did for the C++ agent, and the container restarts.
    const kafka = configService.get('kafka', { infer: true })
    app.connectMicroservice(buildSvtDbAgentNextKafkaOptions(kafka.brokers), { inheritAppConfig: true })
    await app.startAllMicroservices()
    await app.get(SvtDbAgentNextHeartbeatService).start()

    const httpPort = configService.get('httpPort', { infer: true })
    await app.listen(httpPort)
    const version = process.env.APP_VERSION ?? 'local'
    Logger.log(`🚀 SvtDbAgentNext ${version} is running on: http://localhost:${httpPort} (GET /health), Kafka ${kafka.brokers.join(',')}`)
}

bootstrap().catch((error: unknown) => {
    Logger.error('SvtDbAgentNext failed to start', error instanceof Error ? error.stack : String(error))
    process.exit(1)
})
