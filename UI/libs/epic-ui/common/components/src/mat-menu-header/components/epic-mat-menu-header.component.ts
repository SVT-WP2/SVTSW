import { Component, Input } from '@angular/core'


@Component({
    selector: 'epic-mat-menu-header',
    templateUrl: './epic-mat-menu-header.component.html',
})
export class EpicMatMenuHeaderComponent {

    @Input() header: string
    @Input() subheader: string

}
