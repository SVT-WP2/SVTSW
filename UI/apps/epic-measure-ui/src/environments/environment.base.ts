import { deploymentPrefix, Environment } from '@env/common'

import { version } from '../../../../package.json'


export const environmentBase: Environment = {
    production: false,
    deploymentPrefix,
    useMockData: false,
    version: version,
}
