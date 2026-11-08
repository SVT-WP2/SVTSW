import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { AppModule, configureEpicMeasureApiApp, EPIC_MEASURE_API_GLOBAL_PREFIX } from './app'


async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true })
    configureEpicMeasureApiApp(app)

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.KAFKA,
        options: {
            client: {
                brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
            },
            consumer: {
                groupId: 'epic-ui',
                // Kafka's 1 MB defaults are too small for list replies.
                maxBytesPerPartition: 10 * 1024 * 1024,
                maxBytes: 50 * 1024 * 1024,
            },
        },
    })

    // Swagger
    const config = new DocumentBuilder()
        .setTitle('EpicMeasure API')
        .setVersion('1.0')
        .build()
    const documentFactory = () => SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/swagger', app, documentFactory)
    // ./Swagger
    const port = process.env.SVT_UI_API_PORT || 9393
    await app.startAllMicroservices()
    await app.listen(port)
    Logger.log(
        `🚀 API is running on: http://localhost:${port}/${EPIC_MEASURE_API_GLOBAL_PREFIX}`,
    )
}

void bootstrap()
