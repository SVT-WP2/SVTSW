import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { NestExpressApplication } from '@nestjs/platform-express'
import { WsAdapter } from '@nestjs/platform-ws'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as bodyParser from 'body-parser'

import { AppModule } from './app/app.module'


async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true })
    const globalPrefix = 'api'
    app.setGlobalPrefix(globalPrefix)
    app.set('query parser', 'extended')

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.KAFKA,
        options: {
            client: {
                brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
            },
            consumer: {
                groupId: 'epic-ui',
            },
        },
    })

    // max post upload size
    app.use(bodyParser.json({ limit: '50mb' }))
    app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    )

    app.useWebSocketAdapter(new WsAdapter(app))
    app.enableCors()
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
        `🚀 API is running on: http://localhost:${port}/${globalPrefix}`,
    )
}

void bootstrap()
