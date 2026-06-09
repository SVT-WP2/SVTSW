import {ChangeDetectionStrategy, Component, HostBinding, Input, OnInit, OnChanges, SimpleChanges} from '@angular/core'

import { EpicIconComponent } from '../icon'

import { EpicIconTile } from './epic-icon-tile.models'


@Component({
    selector: 'epic-icon-tile',
    templateUrl: './epic-icon-tile.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        EpicIconComponent,
    ],
})
export class EpicIconTileComponent implements OnInit, OnChanges {

    @Input() iconName: string
    @Input() size: EpicIconTile.Size = EpicIconTile.Size.basic
    @Input() shape: EpicIconTile.Shape = EpicIconTile.Shape.circle

    @HostBinding('style.color')
    @Input() color: string

    @HostBinding('style.background')
    @Input() bgColor: string

    @HostBinding('class')
    private cssClass: string

    ngOnInit(): void {
        this.setCssClass(this.size, this.shape)
    }

    ngOnChanges(changes: SimpleChanges) {
        const { size, shape } = changes

        if (size || shape) {
            this.setCssClass(this.size, this.shape)
        }
    }

    private setCssClass(size: EpicIconTile.Size, shape: EpicIconTile.Shape) {
        this.cssClass = EpicIconTile.getCssClass(size, shape)
    }

}
