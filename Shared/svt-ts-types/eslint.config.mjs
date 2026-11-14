// The library is linted with the UI root config: its plugins resolve from UI/node_modules, because Shared/ has no
// node_modules of its own. ESLint reads this file only with lookup from the linted file
// (`--flag v10_config_lookup_from_file`), which `npm run lint:shared` and lint-staged in UI/ use.
import baseConfig, { EPIC_API_TYPES_RESTRICTED_IMPORTS } from '../../UI/eslint.config.mjs'


export default [
    ...baseConfig,
    {
        files: ['**/*.ts'],
        rules: {
            // No framework, no npm package, no workspace lib: the library is compiled into the Angular SPA, the
            // NestJS apps of UI/ and the DB agent. Anything that needs a decorator belongs in `epic/entities` (BFF),
            // `epic-ui/api` (SPA) or the agent's own DTOs.
            'no-restricted-imports': EPIC_API_TYPES_RESTRICTED_IMPORTS,
        },
    },
]
