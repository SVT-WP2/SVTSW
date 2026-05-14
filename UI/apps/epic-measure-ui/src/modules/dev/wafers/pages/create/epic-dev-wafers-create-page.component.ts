import { Component, computed, inject, signal } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card'
import { EpicWaferCreateDialogService, EpicWaferUpdateForm, EpicWaferUpdateFormComponent } from 'epic-ui/shared/wafers'
import { BaseComponent } from 'epic-ui/utils'
import { MarkdownComponent } from 'ngx-markdown'


@Component({
    selector: 'epic-dev-wafers-create-page',
    templateUrl: 'epic-dev-wafers-create-page.component.html',
    imports: [
        MatCard,
        MatCardHeader,
        MatCardTitle,
        MatCardContent,
        EpicWaferUpdateFormComponent,
        MarkdownComponent,
        MatButton,
    ],
})
export class EpicDevWafersCreatePageComponent extends BaseComponent {

    readonly formData = signal<EpicWaferUpdateForm.FormData>(null)

    readonly data = computed<string>(() => {
        return `
            \`\`\`typescript
            const formData = ${JSON.stringify(this.formData() || {}, null, 4)}        
            `
    })

    // DI
    protected readonly epicWaferCreateDialogService = inject(EpicWaferCreateDialogService)

    onCreate(): void {
        this.epicWaferCreateDialogService.openDialog()
    }

}
