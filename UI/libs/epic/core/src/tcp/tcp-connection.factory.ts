import { createConnection, Socket } from 'node:net'


export class TcpConnectionFactory {

    static async connect(portNumber: number, ipAddress?: string): Promise<Socket> {
        return new Promise<Socket>((resolve, reject) => {
            const connection: Socket = createConnection(portNumber, ipAddress, () => {
                resolve(connection)
            })

            connection.on('error', (err) => {
                reject(err)
            })
        })
    }

    static async sendMessage(connection: Socket, message: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const result = connection.write(message, 'utf8', (err) => {
                reject(err)
            })

            connection.on('error', (err) => {
                reject(err)
            })

            if (!result) {
                reject(new Error('Message was not sent'))
            }
            else {
                resolve(result)
            }
        })
    }

    static async readMessage(connection: Socket): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            connection.on('data', (data) => {
                resolve(data.toString())
                connection.end()
            })

            connection.on('error', (err) => {
                reject(err)
            })

        })
    }

    static async sendAndMessage(connection: Socket, message: string): Promise<string> {
        await TcpConnectionFactory.sendMessage(connection, message)
        return await TcpConnectionFactory.readMessage(connection)
    }

}
