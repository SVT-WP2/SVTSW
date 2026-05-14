export const deploymentPrefix = '/app'

export type Environment = {
    production: boolean
    deploymentPrefix: string
    useMockData: boolean
    version: string
}
