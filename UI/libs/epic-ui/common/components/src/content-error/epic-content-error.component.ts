import { Component, Input } from '@angular/core'


@Component({
    selector: 'epic-content-error',
    templateUrl: './epic-content-error.component.html',
    standalone: false,
})
export class EpicContentErrorComponent {

    @Input() title = 'COMMON.CONTENT_ERROR_MESSAGE'
    @Input() floating = true
    @Input() transparentBackground = true
    @Input() showImage = true

}
