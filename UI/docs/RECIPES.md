# Recipes

Step-by-step checklists for the changes we actually make. Every path is real; every snippet is trimmed from
existing code. Read [ARCHITECTURE.md](ARCHITECTURE.md) first if you don't know where things live.

Throughout, `<Domain>` is the PascalCase entity (`SvtTest`) and `<domain>` its kebab form (`svt-test`).

---

## Recipe 1 — A new entity, end to end

Order matters: contract first, then the two Node sides, then the UI. Each layer compiles independently once
the one below it exists.

### 1.1 Kafka contract — `libs/epic/entities/src/kafka/db-agent/kafka-messages/`

Check `../Documentation/Kafka/SvtKafkaConventions.md` for the agreed message names **before** writing this.

Create `svt-db-agent-kafka-<domain>s.ts`:

```ts
import { Epic<Domain>CreateEntity, Epic<Domain>Entity, Epic<Domain>sGetAllParams } from '../../../<domain>s'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'


export namespace SvtDbAgentKafka<Domain>s {

    export enum MessageType {
        GetAll<Domain>s = 'GetAll<Domain>s',
        GetAll<Domain>sReply = 'GetAll<Domain>sReply',
        Create<Domain> = 'Create<Domain>',
        Create<Domain>Reply = 'Create<Domain>Reply',
    }

    export type GetAll<Domain>sData = { filter?: Epic<Domain>sGetAllParams }

    export class GetAll<Domain>sMessage extends EpicKafkaMessageClass<GetAll<Domain>sData> {

        readonly type = MessageType.GetAll<Domain>s

    }

    export type GetAll<Domain>sReplyMessageData = { items: Epic<Domain>Entity[] }

    export class GetAll<Domain>sReplyMessage extends EpicKafkaReplyMessageClass<GetAll<Domain>sReplyMessageData> {

        readonly type = MessageType.GetAll<Domain>sReply

    }

    export type RequestMessage = GetAll<Domain>sMessage | Create<Domain>Message
    export type ReplyMessage = GetAll<Domain>sReplyMessage | Create<Domain>ReplyMessage
    export type Message = RequestMessage | ReplyMessage

}
```

Export it from `kafka-messages/index.ts`.

### 1.2 Entities + DTOs — `libs/epic/entities/src/<domain>s/`

```
models/epic-<domain>.models.ts          Epic<Domain>Entity, Epic<Domain>CreateEntity, …GetAllParams
dtos/epic-<domain>.dto.ts               Epic<Domain>Dto           (class-validator + @ApiProperty)
dtos/epic-<domain>-create.dto.ts        Epic<Domain>CreateDto
dtos/epic-<domain>s-get-all-params.dto.ts
models/index.ts, dtos/index.ts, index.ts
```

Models are plain types (the Kafka wire shape). DTOs are decorated classes (the HTTP shape) — they drive
Swagger *and* the `ClassSerializerInterceptor`. Add the domain to `libs/epic/entities/src/index.ts`.

### 1.3 Mock DB Agent — `apps/epic-db-agent/src/modules/db-agent/`

`services/epic-db-agent-<domain>s.service.ts` — an in-memory array plus `of(...).pipe(delay(50))` so the UI
sees realistic async behaviour:

```ts
@Injectable()
export class EpicDbAgent<Domain>sService {

    protected data: Epic<Domain>Entity[] = [ /* 2–3 realistic rows */ ]

    getAll(queryFilter?: Epic<Domain>sGetAllParams): Observable<Epic<Domain>Entity[]> {
        const result = this.data.filter(item => !queryFilter?.ids || queryFilter.ids.includes(item.id))
        return of(result).pipe(delay(50))
    }

}
```

Then:
- export from `services/index.ts`;
- register in `epic-db-agent.module.ts` `providers`;
- inject into `controllers/epic-db-agent-wafers.controller.ts` (yes, that one file handles every domain),
  add the new `Message` union member to the `@Payload()` type, and add `case` branches:

```ts
case SvtDbAgentKafka<Domain>s.MessageType.GetAll<Domain>s:
    return this.epicDbAgent<Domain>sService.getAll(message.data.filter)
        .pipe(map(items => JSON.stringify(new SvtDbAgentKafka<Domain>s.GetAll<Domain>sReplyMessage({ items }))))
```

### 1.4 API module — `apps/epic-measure-api/src/modules/<domain>/`

```
models/epic-<domain>-svc.models.ts    export namespace Epic<Domain>Svc { export const SERVICE_NAME = '…' }
services/epic-<domain>s.service.ts    Kafka send + unwrap
controllers/epic-<domain>s-controller.ts
epic-<domain>.module.ts
index.ts
```

Service — copy the shape exactly, the `onModuleInit` subscription is easy to forget:

```ts
@Injectable()
export class Epic<Domain>sService implements OnModuleInit {

    constructor(@Inject(Epic<Domain>Svc.SERVICE_NAME) private readonly kafkaClient: ClientKafka) {
    }

    getAll(filter?: Epic<Domain>sGetAllParams): Observable<Epic<Domain>Entity[]> {
        const message = new SvtDbAgentKafka<Domain>s.GetAll<Domain>sMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafka<Domain>s.GetAll<Domain>sReplyMessage>(message)
            .pipe(mapEpicKafkaMessageData(), mapSvtDbAgentListReplyData())
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<T>(message: SvtDbAgentKafka<Domain>s.Message): Observable<T> {
        return this.kafkaClient.send<T>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
```

Use `mapSvtDbAgentEntityReplyData()` instead for single-entity replies.

Controller — thin, and every handler wrapped in `processKafkaReplyError`:

```ts
@Controller('/<domain>s')
export class Epic<Domain>sController {

    @Get()
    @ApiResponse({ type: Epic<Domain>Dto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: Epic<Domain>Dto })
    async getAll(@Query() params: Epic<Domain>sGetAllParamsDto): Promise<Epic<Domain>Dto[]> {
        return processKafkaReplyError(() => firstValueFrom(this.service.getAll({ ids: params.ids })))
    }

}
```

Finally register the module in `apps/epic-measure-api/src/app/app.module.ts`.

### 1.5 UI HTTP client — `libs/epic-ui/api/main/src/<domain>s/`

```
models/epic-<domain>.models.ts             Epic<Domain>, Epic<Domain>Create  (plain types)
models/query/epic-<domain>s-list-query.models.ts
services/epic-<domain>s.api-client.ts
index.ts (+ barrels)
```

```ts
@Injectable({ providedIn: 'root' })
export class Epic<Domain>sApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/<domain>s`

    protected readonly httpClient = inject(HttpClient)

    fetchList(queryFilter: Epic<Domain>sListQuery.QueryFilter = {}): Observable<Epic<Domain>[]> {
        return this.httpClient.get<Epic<Domain>[]>(this.baseUrl, {
            params: QueryHelpers.applyQueryParams({ ...queryFilter }),
        })
    }

}
```

Add a matching `Epic<Domain>sApiClientMock` in `libs/epic-ui/api/__mock__/src/<domain>s/` and wire the
`{ provide: Epic<Domain>sApiClient, useClass: Epic<Domain>sApiClientMock }` pair into
`apps/epic-measure-ui/src/app/app.mock.providers.ts`.

### 1.6 UI feature lib — `libs/epic-ui/shared/<domain>s/`

See [Recipe 3](#recipe-3--a-new-feature-lib) for scaffolding. Minimum for a list: `models/*-grid.models.ts`,
`services/*-grid.data-source.ts`, `components/<domain>s-list/`.

### 1.7 Page + route — `apps/epic-measure-ui/src/modules/<domain>s/`

```
epic-<domain>s.routing.ts
pages/<domain>s-list/epic-<domain>s-list-page.component.{ts,html}
pages/index.ts
```

Register lazily in `src/app/app.routes.ts` and add the sidebar entry in
`src/app/models/app-sidebar-nav.models.ts`.

### Checklist

- [ ] Kafka message namespace + barrel export
- [ ] Entities/models + DTOs + barrels + root `index.ts`
- [ ] db-agent service, module provider, controller `case`s + `@Payload()` union
- [ ] API service, controller, module, registered in `app.module.ts`
- [ ] `epic-ui/api` client + models + `__mock__` twin + `app.mock.providers.ts`
- [ ] Feature lib (grid models, data source, list component)
- [ ] Page component + routing + `app.routes.ts` + sidebar
- [ ] `npm run pre-pull-request` clean

---

## Recipe 2 — A new list page over an existing entity

The common case. No Kafka or API changes.

1. **Grid models** — `libs/epic-ui/shared/<domain>/src/models/epic-<domain>s-grid.models.ts`:

```ts
export namespace Epic<Domain>sGrid {

    export enum ColId { id = 'id', name = 'name', actions = 'actions' }

    export type RowEntity = Epic<Domain>

    export enum CellEventEvent { Details = 'Details' }

    export function getColDefs(): ColDef<RowEntity>[] {
        return [
            { field: ColId.id, headerName: 'ID', minWidth: 80, sort: 'desc' },
            { field: ColId.name, headerName: 'Name', flex: 1, minWidth: 140 },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    actions: () => [{
                        icon: toEpicMatOutlinedIcon('visibility'),
                        onClick: () => ({ eventName: CellEventEvent.Details }),
                        tooltip: 'Details',
                    }],
                }),
                width: AgIconActionsCell.getCellWidth(1),
                cellRenderer: AgIconActionsCellComponent,
            },
        ]
    }

    export function getGridOptions(): GridOptions<RowEntity> {
        return {
            ...EpicAgGrid.getDefaultGridOptions<RowEntity>(),
            getRowId: ({ data }) => data.id.toString(),
        }
    }

}
```

Dates use `valueFormatter: params => params.value ? moment(params.value).format('DD.MM.YY - HH:mm:ss') : '-'`.

2. **Data source** — `services/epic-<domain>s-grid.data-source.ts`, subclass `SimpleDataSource` and implement
   `getDataObserver()` (see ARCHITECTURE §6).

3. **List component** — `components/<domain>s-list/`, standalone, presentational:

```ts
@Component({
    selector: 'epic-<domain>s-list',
    templateUrl: 'epic-<domain>s-list.component.html',
    standalone: true,
    imports: [AgGridModule, AgIconActionsCellModule, AgGridCellEventDirective],
})
export class Epic<Domain>sListComponent extends BaseComponent {

    @Input({ required: true }) entitiesList!: Grid.RowEntity[]

    @Output() rowClicked$ = new EventEmitter<Grid.RowEntity>()
    @Output() details$ = new EventEmitter<Grid.RowEntity>()

    readonly colDefs = Grid.getColDefs()
    readonly gridOptions = Grid.getGridOptions()

    onCellEvent(event: EpicAgGridCell.CellRendererEvent<Grid.CellEventEvent, any, Grid.RowEntity>): void {
        switch (event.eventName) {
            case Grid.CellEventEvent.Details:
                this.details$.emit(event.rowData)
                break
            default:
            // DO NOTHING
        }
    }

}
```

4. **Page component** — owns the data source lifecycle, converts to signals:

```ts
export class Epic<Domain>sListPageComponent extends BaseComponent implements OnInit, OnDestroy {

    readonly entitiesList: Signal<Grid.RowEntity[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly dataSource = inject(Epic<Domain>sGridDataSource)

    constructor() {
        super()
        this.entitiesList = toSignal(this.dataSource.data$)
        this.dataFetchingProcessing = toSignal(this.dataSource.loadingProcessing$)
    }

    ngOnInit(): void {
        this.dataSource.connect()
        this.dataSource.load()
    }

    override ngOnDestroy(): void {
        super.ngOnDestroy()
        this.dataSource.disconnect()
    }

    onReload(): void {
        this.dataSource.load(true)
    }

}
```

Always `disconnect()` in `ngOnDestroy` — the data source is `providedIn: 'root'` and outlives the page.

5. Add the route and, if it's a top-level section, the sidebar entry.

---

## Recipe 3 — A new feature lib

1. Generate or copy the skeleton under `libs/epic-ui/shared/<domain>/main/`. Copying an existing small lib
   (`libs/epic-ui/shared/svt-tests/tests/`) is faster and keeps the configs consistent — it needs
   `project.json`, `jest.config.ts`, `tsconfig{,.lib,.spec}.json`, `eslint.config.mjs`, `src/test-setup.ts`,
   `src/index.ts`.
2. Add the alias to `tsconfig.base.json` `compilerOptions.paths`, pointing at `.../src/index.ts`.
3. If the lib has **styles**, add `libs/epic-ui/shared/<domain>/main/styles` to
   `stylePreprocessorOptions.includePaths` in `apps/epic-measure-ui/project.json`.
4. If the lib has **assets**, add an entry to the `assets` array in the same file.
5. Barrel everything through `src/index.ts`.

Forgetting steps 3–4 produces a build that succeeds but renders unstyled / with missing images.

---

## Recipe 4 — Adding NgRx state for a domain

Only when several pages read the entity and caching pays off. Otherwise use a `SimpleDataSource`.

Under `libs/epic-ui/shared/<domain>/main/src/store/`:

- `actions/epic-<domain>.actions.ts` — an `ActionType` enum plus `fetch/create/update` × `Request/Success/Error`
  triples and a `leave` action. Action strings are `'[<Domain>] fetchAllRequest'`.
- `epic-<domain>.store.ts` — `FEATURE_NAME`, `State`, `createEntityAdapter`, `defaultState`, `createReducer`.
  Every async operation gets its own `ProcessingStore.EventProcessingState` field (`fetchAllProcessing`,
  `createProcessing`, …) driven by `eventProcessingStart` / `eventProcessingFinish(state, error?)`.
- `effects/epic-<domain>.effects.ts` — `createEffect` per request action, `mapResponse({ next, error })` from
  `@ngrx/operators`, `takeUntil(this.leaveAction$)` on long fetches. The fetch-all effect short-circuits:

```ts
concatLatestFrom(() => [this.store.select(Selectors.selectIsAllDataFetched), …]),
mergeMap(([{ force }, isAllDataFetched, entities]) => {
    if (!force && isAllDataFetched) {
        return of(Actions.fetchAllSuccessAction({ entities })).pipe(delay(50))
    }
    return this.apiClient.fetchList().pipe(/* … */)
})
```

- `selectors/`, and `services/epic-<domain>.store.facade.ts` — the facade dispatches a request action and
  returns an Observable that completes on the first matching success/error action, so components never touch
  `Store` directly.
- `epic-<domain>-store.providers.ts` exporting `provideEpic<Domain>Store()` with `provideState` + `provideEffects`.

Register it in `apps/epic-measure-ui/src/app/app.module.ts` providers.

---

## Recipe 5 — A create/edit dialog

Per existing `svt-tests` dialogs:

```
forms/<name>/epic-<name>-form.component.{ts,html}   presentational form
forms/<name>/epic-<name>-form.factory.ts            builds the FormGroup
forms/<name>/epic-<name>-form.models.ts             form value types
dialogs/<name>/epic-<name>-dialog.component.{ts,html}
dialogs/<name>/epic-<name>-dialog.models.ts         dialog data + result types
services/epic-<name>-dialog.service.ts              open(...) returning Observable<Result>
```

Components extend the relevant base from `epic-ui/utils` (`BaseFormComponent`,
`BaseFormWithFactoryComponent`, `BaseFormDialogComponent`). Callers inject the `*-dialog.service.ts`, never
`MatDialog`.

---

## Recipe 6 — Running the stack locally

```bash
docker compose up -d zookeeper kafka kafka-ui
```

```bash
npm run start::db-agent
```

```bash
npm run start
```

- App: http://localhost:7755/app
- Swagger: http://localhost:7373/api/swagger
- Kafka UI: http://localhost:8088 — inspect `svt.db-agent.request` traffic here when a call goes quiet.

**No Kafka at all?** Flip the UI to mock clients instead — in the browser console:

```js
localStorage.setItem('epic.mockSettings', JSON.stringify({ useMockData: true }))
```

Then reload. The Angular app serves everything from `epic-ui/api/__mock__` and the API is never called.

### When a request hangs

An API call that never resolves almost always means the Kafka round trip didn't complete. Check, in order:
the broker is up; `epic-db-agent` is running; the service calls `subscribeToResponseOf` in `onModuleInit`;
the db-agent controller has a `case` for that `MessageType`; the `@Payload()` union includes the new
`Message` type.
