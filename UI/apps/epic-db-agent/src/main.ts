import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Transport } from '@nestjs/microservices'
import { CompressionTypes } from 'kafkajs'

import { AppModule } from './app/app.module'


async function bootstrap() {
    const app = await NestFactory.createMicroservice(AppModule, {
        transport: Transport.KAFKA,
        options: {
            client: {
                brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
            },
            consumer: {
                groupId: 'epic-ui.fake-db-agent',
                // Kafka's 1 MB defaults are too small for list replies.
                maxBytesPerPartition: 10 * 1024 * 1024,
                maxBytes: 50 * 1024 * 1024,
            },
            // Broker limits apply to the *compressed* batch, and these replies
            // are JSON - gzip keeps them well under the ceiling.
            send: {
                compression: CompressionTypes.GZIP,
            },
        },
    })

    await app.listen()

    Logger.log(
        `🚀 Epic DB Agent is running and listening to Kafka on ${process.env.KAFKA_BROKER}`,
    )
}

void bootstrap()
