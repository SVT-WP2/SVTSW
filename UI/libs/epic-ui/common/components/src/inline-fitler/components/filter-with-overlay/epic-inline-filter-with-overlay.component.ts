import { AfterViewInit, Component, EventEmitter, Input, Output, ViewChild } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { ThemePalette } from '@angular/material/core'
import { MatMenu, MatMenuContent, MatMenuTrigger } from '@angular/material/menu'
import { TranslateModule } from '@ngx-translate/core'
import { BaseComponent } from 'epic-ui/utils'
import { takeUntil } from 'rxjs/operators'

import { EpicDotDividerComponent } from '../../../dot-divider'
import { EpicInlineFilterComponent } from '../inline-filter'


@Component({
    selector: 'epic-inline-filter-with-overlay',
    templateUrl: './epic-inline-filter-with-overlay.component.html',
    imports: [
        TranslateModule,
        MatButtonModule,
        MatMenu,
        MatMenuTrigger,
        MatMenuContent,
        EpicDotDividerComponent,
        EpicInlineFilterComponent,
    ],
})
export class EpicInlineFilterWithOverlayComponent extends BaseComponent implements AfterViewInit {

    @Input() icon: string
    @Input() isIconOnly = false
    @Input() label: string
    @Input() isActive: boolean
    @Input() disabled: boolean
    @Input() selectedItemsNumber: number
    @Input() applyItemsNumber: number
    @Input() suppressFooterActions = false

    @Input() applyBtnDisabled = false
    @Input() applyBtnLabel: string | undefined
    @Input() applyBtnColor: ThemePalette = 'primary'

    @Output() apply$ = new EventEmitter<MouseEvent>()
    @Output() cancel$ = new EventEmitter<MouseEvent>()
    @Output() panelClosed$ = new EventEmitter<void>()
    @Output() panelOpened$ = new EventEmitter<void>()

    @ViewChild(MatMenuTrigger, { static: false }) matMenuTrigger: MatMenuTrigger

    get isOpened(): boolean {
        return this.matMenuTrigger?.menuOpen ?? false
    }

    ngAfterViewInit(): void {
        this.matMenuTrigger.menuClosed
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe(
                () => this.panelClosed$.emit(),
            )

        this.matMenuTrigger.menuOpened
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe(
                () => this.panelOpened$.emit(),
            )
    }

    onCancelBtnClicked(mouseEvent: MouseEvent): void {
        this.cancel$.emit(mouseEvent)
        this.closePanel()
    }

    onApplyBtnClicked(mouseEvent: MouseEvent): void {
        this.apply$.emit(mouseEvent)
        this.closePanel()
    }

    closePanel(): void {
        this.matMenuTrigger.closeMenu()
    }

}
