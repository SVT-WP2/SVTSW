import { Component, computed, inject, signal } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card'
import { EpicChipCreate } from 'epic-ui/api'
import {
    EpicChipCreateManyPreviewDialogService,
    EpicChipCreateManyPreviewGridComponent,
    EpicChipCreateWithFileDialogService,
    EpicChipCreateWithFileForm,
    EpicChipCreateWithFileFormComponent,
} from 'epic-ui/shared/chips'
import { BaseComponent } from 'epic-ui/utils'
import { MarkdownComponent } from 'ngx-markdown'


@Component({
    selector: 'epic-dev-asics-create-chip-page',
    templateUrl: 'epic-dev-asics-create-chip-page.component.html',
    imports: [
        MatCard,
        MatCardHeader,
        MatCardTitle,
        MatCardContent,
        MarkdownComponent,
        MatButton,
        EpicChipCreateWithFileFormComponent,
        EpicChipCreateManyPreviewGridComponent,
    ],
})
export class EpicDevAsicsCreateChipPageComponent extends BaseComponent {

    readonly formData = signal<EpicChipCreateWithFileForm.FormData>(null)

    readonly data = computed<string>(() => {
        return `
            \`\`\`typescript
            const formData = ${JSON.stringify(this.formData() || {}, null, 4)}        
            `
    })

    readonly createManyData = signal<EpicChipCreate[]>(this.generateCreateMany())

    // DI
    protected readonly epicChipCreateWithFileDialogService = inject(EpicChipCreateWithFileDialogService)
    protected readonly epicChipCreateManyPreviewDialogService = inject(EpicChipCreateManyPreviewDialogService)

    onCreate(): void {
        this.epicChipCreateWithFileDialogService.openDialog()
    }

    onCreateManyPreview(): void {
        this.epicChipCreateManyPreviewDialogService.openDialog({
            data: this.createManyData(),
        })
    }

    private generateCreateMany(): EpicChipCreate[] {
        return [...new Array(100)]
            .map((_, index) => ({
                asicId: index,
                serialNumber: `chip-${index}`,
                generalLocation: 'Location #1',
            }))
    }

}
