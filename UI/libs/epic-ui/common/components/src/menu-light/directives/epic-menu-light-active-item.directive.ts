import { AfterViewInit, Directive, EventEmitter, HostBinding, Input, OnChanges, Output, SimpleChanges } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { BaseDirective } from 'epic-ui/utils'
import { filter, takeUntil } from 'rxjs/operators'

import { EpicMenuLightItemBase } from '../models'


@Directive({
    selector: '[epicMenuLightActiveItem]',
    standalone: false,
})
export class EpicMenuLightActiveItemDirective extends BaseDirective implements AfterViewInit, OnChanges {

    @HostBinding('class.active') isActive = false

    @Output() activeStateChanged$ = new EventEmitter<boolean>()

    @Input() item: EpicMenuLightItemBase

    private initialized = false

    constructor(private readonly router: Router) {
        super()

        // Watch router changes to calculate active state
        router.events
            .pipe(
                takeUntil(this.destroyed$),
                filter((event) => event instanceof NavigationEnd),
            )
            .subscribe(() => {
                this.initialized = true
                this.updateActiveState(this.item)
            })
    }

    ngAfterViewInit(): void {
        // Init if the directive is initialized after router event finished
        if (!this.initialized) {
            this.updateActiveState(this.item)
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        const { item } = changes

        if (item && !item.firstChange) {
            this.updateActiveState(item.currentValue)
        }
    }

    private updateActiveState(item: EpicMenuLightItemBase): void {
        const newIsActive = this.calculateActiveState(item)
        if (newIsActive !== this.isActive) {
            this.onActiveStateChanged(newIsActive)
        }

    }

    private onActiveStateChanged(isActive: boolean): void {
        setTimeout(() => {
            this.isActive = isActive
            this.activeStateChanged$.emit(isActive)
        })
    }

    private calculateActiveState(item: EpicMenuLightItemBase): boolean {
        const pattern = item.routerUrlPattern || (item.routerLink ? `^${item.routerLink}$` : null)

        if (pattern && new RegExp(pattern).exec(this.router.url)) {
            return true
        }

        const submenuItems = item.submenu?.items
        if (submenuItems?.length) {
            const activeItem = submenuItems?.find(submenuItem => this.calculateActiveState(submenuItem))

            if (activeItem) {
                return true
            }
        }

        return false
    }

}
