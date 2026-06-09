import { HttpBackend } from '@angular/common/http'
import moment from 'moment'
import { MultiTranslateHttpLoader } from 'ngx-translate-multi-http-loader'


export function getAssetsNamesList(): string[] {
    return [
        'epic-common.components',
    ]
}


export function TranslateLoaderFactory(
    httpBackend: HttpBackend,
): MultiTranslateHttpLoader {

    const loaderAssets = getAssetsNamesList()
        .map(
            asset => ({
                prefix: `./assets/i18n/${asset}/`,
                suffix: `.json?cache=${moment().format('DD-MM-YYYY')}`,
            }),
        )
    return new MultiTranslateHttpLoader(httpBackend, loaderAssets)
}
