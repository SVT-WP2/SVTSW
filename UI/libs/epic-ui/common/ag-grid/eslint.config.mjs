import baseConfig, {extendRootConfigWithNgSelectors} from '../../../../eslint.config.mjs'

export default [
    ...baseConfig,
    ...extendRootConfigWithNgSelectors(),
]
