import { Injectable } from '@nestjs/common'
import { TcpConnectionFactory } from 'epic/core'


@Injectable()
export class EpicTcpService {

    async sendMessage(ipAddress: string, portNumber: number, message: string): Promise<boolean> {
        const connection = await TcpConnectionFactory.connect(portNumber, ipAddress)
        return await TcpConnectionFactory.sendMessage(connection, message)
    }

    async readMessage(ipAddress: string, portNumber: number): Promise<string> {
        const connection = await TcpConnectionFactory.connect(portNumber, ipAddress)
        return await TcpConnectionFactory.readMessage(connection)
    }

    async sendAndReadMessage(ipAddress: string, portNumber: number, message: string): Promise<string> {
        const connection = await TcpConnectionFactory.connect(portNumber, ipAddress)
        return await TcpConnectionFactory.sendAndMessage(connection, message)
    }

}
