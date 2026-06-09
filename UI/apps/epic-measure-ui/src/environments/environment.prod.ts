import { Environment } from '@env/common'

import { environmentBase } from './environment.base'


export const environment: Environment = {
    ...environmentBase,
    production: true,
}
