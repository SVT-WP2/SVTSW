import { DOCUMENT } from '@angular/common'
import { Component, inject, input } from '@angular/core'
import { EpicWaferType, EpicWaferTypeMap, EpicWaferTypesApiClient } from 'epic-ui/api'
import { EpicButtonModule, EpicNotificationService } from 'epic-ui/common/components'
import { BaseComponent, FileHelpers } from 'epic-ui/utils'
import { catchError, of, switchMap, throwError } from 'rxjs'


@Component({
    selector: 'epic-wafer-type-info',
    templateUrl: 'epic-wafer-type-info.component.html',
    standalone: true,
    imports: [
        EpicButtonModule,
    ],
})
export class EpicWaferTypeInfoComponent extends BaseComponent {

    readonly entity = input.required<EpicWaferType>()

    protected readonly document = inject(DOCUMENT)
    protected readonly epicWaferTypesApiClient = inject(EpicWaferTypesApiClient)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    onWaferMapDownload(): void {

        this.epicWaferTypesApiClient.fetchWaferTypeMap(this.entity().id)
            .pipe(
                switchMap(result =>
                    result
                        ? of(result)
                        : throwError(() => new Error('Wafer Type Map was not Found')),
                ),
                catchError((error) => {
                    this.epicNotificationService.error(
                        error.message,
                    )
                    return throwError(() => error)
                }),
            )
            .subscribe((waferTypeMap) => {
                this.processFileDownload(waferTypeMap)
            })
    }

    protected processFileDownload(waferTypeMap: EpicWaferTypeMap): void {
        const waferFile = FileHelpers.stringContentToJsonFile(
            waferTypeMap.waferMap,
            'wafer-map.json',
        )

        void waferFile.arrayBuffer()
            .then(
                (arrayBuffer) => FileHelpers.saveFile(arrayBuffer, waferFile.name, waferFile.type, this.document),
            )
    }

}
