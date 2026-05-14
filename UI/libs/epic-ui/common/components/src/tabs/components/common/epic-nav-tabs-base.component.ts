import { Component, ContentChild, Input } from '@angular/core'
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router'
import { BaseComponent } from 'epic-ui/utils'
import { filter, takeUntil } from 'rxjs/operators'

import { EpicTabContentDirective } from '../../directives'
import { EpicNavTabs } from '../../models'


@Component({
    selector: 'epic-nav-tabs-base',
    template: '',
    standalone: false,
})
export abstract class EpicNavTabsBaseComponent extends BaseComponent {

    @ContentChild(EpicTabContentDirective) tabContentTemplate: EpicTabContentDirective
    decoratedTabs: EpicNavTabs.NavTabInfo[] = []

    constructor(private readonly router: Router,
        private readonly activatedRoute: ActivatedRoute) {

        super()

        this.router.events
            .pipe(
                takeUntil(this.destroyed$),
                filter(navObj => navObj instanceof NavigationEnd),
            )
            .subscribe((navObj: NavigationEnd) => {
                this.decoratedTabs = this.decoratedTabs.map(
                    currentTab => EpicNavTabs.decorateNavTabActive(currentTab, navObj.url),
                )
            })
    }

    @Input() set tabs(tabs: EpicNavTabs.NavTabInfo[]) {
        const currentUrl = this.activatedRoute.snapshot.url.toString()
        this.decoratedTabs = tabs.map(
            currentTab => EpicNavTabs.decorateNavTabActive(currentTab, currentUrl),
        )
    }

}
