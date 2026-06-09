import { DOCUMENT } from '@angular/common'
import { ChangeDetectionStrategy, Component, EventEmitter, Inject, Input, Output } from '@angular/core'
import { TranslatePipe } from '@ngx-translate/core'

import { EpicIconComponent } from '../icon'
import { EpicLongTextComponent } from '../long-text'


@Component({
    selector: 'epic-file-preview',
    templateUrl: './epic-file-preview.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        EpicIconComponent,
        EpicLongTextComponent,
        TranslatePipe,
    ],
})
export class EpicFilePreviewComponent {

    @Input() iconName = 'description'
    @Input() fileName: string

    @Output() download$ = new EventEmitter<void>()

    constructor(@Inject(DOCUMENT) protected readonly document: Document) {
    }

    onDownloadActionClicked(): void {
        this.download$.emit()
    }

}
