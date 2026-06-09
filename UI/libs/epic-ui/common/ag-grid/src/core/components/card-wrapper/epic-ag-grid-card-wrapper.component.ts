import { Component, HostBinding, Input } from '@angular/core'


@Component({
    selector: 'epic-ag-grid-card-wrapper',
    templateUrl: './epic-ag-grid-card-wrapper.component.html',
})
export class EpicAgGridCardWrapperComponent {

    @Input() isFullHeight = false

    @HostBinding('class')
    get className(): string {
        return this.isFullHeight ? 'position-relative d-flex w-100 h-100' : ''
    }

}
