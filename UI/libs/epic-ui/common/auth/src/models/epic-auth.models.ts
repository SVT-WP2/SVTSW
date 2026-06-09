import CryptoES from 'crypto-es'


export namespace EpicAuth {

    export type UserInfo = {
        id: number
        login: string
        name: string
        role: UserRole
    }

    export enum UserRole {
        Admin = 'Admin',
        Operator = 'Operator',
    }

    // dummy password
    export function getUsersList(): UserInfo[] {
        return [
            {
                id: 1,
                name: 'Admin',
                login: 'admin',
                role: UserRole.Admin,
            },
            {
                id: 2,
                name: 'Operator',
                login: 'operator',
                role: UserRole.Operator,
            },
        ]
    }

    export function getUserPasswordHash(userId: number) {
        switch (userId) {
            case 1:
                return 'afd8f0f962a394501d704a377bce4d814ba2e00d20433f0b26858f9cf3a7f7d1663aadbdf3cd6cab41' +
                    'df09607ffca447a67db06ff66e3b667994203b47cdaacd.c5d2449997ec540484ac5c1e6afcedf2'
            default:
                throw new Error('Unknown user')

        }
    }

    export function hashPassword(password: string): string {
        const salt = CryptoES.lib.WordArray.random(128 / 8).toString(CryptoES.enc.Hex)
        const hash = CryptoES.PBKDF2(password, salt, { keySize: 512 / 32, iterations: 1000 })
        return `${hash.toString(CryptoES.enc.Hex)}.${salt}`
    }

    export function comparePassword(
        storedPassword: string,
        suppliedPassword: string,
    ): boolean {
        const [hashedPassword, salt] = storedPassword.split('.')
        const encryptHash = CryptoES.PBKDF2(suppliedPassword, salt, { keySize: 512 / 32, iterations: 1000 })
        return encryptHash.toString(CryptoES.enc.Hex) === hashedPassword
    }

}
