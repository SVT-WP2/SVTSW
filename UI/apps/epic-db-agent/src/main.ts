import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Transport } from '@nestjs/microservices'

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
            },
        },
    })

    await app.listen()

    Logger.log(
        `🚀 Epic DB Agent is running and listening to Kafka on ${process.env.KAFKA_BROKER}`,
    )
}

void bootstrap()
