export namespace EntityStore {

    export type BaseEntity = Record<string, any>
    export type EntityId = string | number
    export type EntitiesMap<T extends BaseEntity, TKey extends EntityId = number> = Partial<{ [key in TKey]: T }>

    export type EntityState<T extends BaseEntity, TKey extends EntityId = number> = {
        ids: TKey[]
        entities: EntitiesMap<T, TKey>
    }

    export type EntityUpdate<T extends BaseEntity, TKey extends EntityId = number> = {
        id: TKey
        update: Partial<T>
    }

    export function getDefaultState<T extends BaseEntity, TKey extends EntityId = number>(): EntityState<T, TKey> {
        return {
            ids: [],
            entities: {},
        }
    }

    export function defaultSelectIdFn<T extends BaseEntity, TKey extends EntityId = number>(entity: T): TKey {
        return entity['id']
    }

    export type SelectIdFn<T extends BaseEntity, TKey extends EntityId = number> = (entity: T) => TKey

    export function entitiesListToDictionary<T extends BaseEntity, TKey extends EntityId = number>(
        entities: T[],
        selectEntityIdFn: SelectIdFn<T, TKey>,
    ): EntitiesMap<T, TKey> {
        return entities.reduce<EntitiesMap<T, TKey>>(
            (result, currentEntity) => {
                const id = selectEntityIdFn(currentEntity)
                result[id] = currentEntity
                return result
            },
            {},
        )
    }

    // REDUCERS

    export function addAll<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(
        entities: T[],
        state: TState,
        selectId: SelectIdFn<T, TKey> = defaultSelectIdFn,
    ): TState {

        return {
            ...state,
            ids: entities.map(selectId),
            entities: entities.reduce<EntitiesMap<T, TKey>>(
                (result, currentEntity) => {
                    const id = selectId(currentEntity)
                    result[id] = currentEntity
                    return result
                },
                {},
            ),
        }
    }

    export function addMany<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(
        entities: T[],
        state: TState,
        selectIdFn: SelectIdFn<T, TKey> = defaultSelectIdFn,
    ): TState {

        return {
            ...state,
            ids: [...state.ids, ...entities.map(selectIdFn)],
            entities: {
                ...state.entities,
                ...entitiesListToDictionary<T, TKey>(entities, selectIdFn),
            },
        }
    }

    export function upsertMany<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(
        entities: T[],
        state: TState,
        selectId: SelectIdFn<T, TKey> = defaultSelectIdFn,
    ): TState {

        return entities.reduce(
            (newState: TState, entity: T) => {
                const id = selectId(entity)
                return newState.entities[id]
                    ? updateOne({ id, update: entity }, newState)
                    : addOne(entity, newState, selectId)
            },
            state,
        )
    }

    export function addOne<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(
        entity: T,
        state: TState,
        selectId: SelectIdFn<T, TKey> = defaultSelectIdFn,
    ): TState {

        const id = selectId(entity)

        return {
            ...state,
            ids: [...state.ids, id],
            entities: {
                ...state.entities,
                [id]: entity,
            },
        }
    }

    export function updateOne<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(
        payload: EntityUpdate<T, TKey>,
        state: TState,
    ): TState {

        return {
            ...state,
            entities: {
                ...state.entities,
                [payload.id]: {
                    ...state.entities[payload.id],
                    ...payload.update,
                },
            },
        }
    }

    export function updateMany<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(
        payload: EntityUpdate<T, TKey>[],
        state: TState,
    ): TState {

        const entitiesUpdate = payload.reduce<EntitiesMap<T, TKey>>(
            (result, currentEntityUpdate) => {
                const currentEntity = state.entities[currentEntityUpdate.id] as T
                result[currentEntityUpdate.id] = {
                    ...currentEntity,
                    ...currentEntityUpdate.update,
                }
                return result
            },
            {},
        )

        return {
            ...state,
            entities: {
                ...state.entities,
                ...entitiesUpdate,
            },
        }
    }

    export function removeOne<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(
        id: TKey,
        state: TState,
    ): TState {

        const ids = state.ids.filter(item => item !== id)

        return {
            ...state,
            ids,
            entities: ids.reduce<EntitiesMap<T, TKey>>(
                (result, currentId) => {
                    result[currentId] = state.entities[currentId]
                    return result
                },
                {},
            ),
        }
    }

    export function removeMany<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(
        ids: TKey[],
        state: TState,
    ): TState {

        const newIds = state.ids
            .filter(
                item => !ids.includes(item),
            )

        return {
            ...state,
            ids: newIds,
            entities: newIds.reduce<EntitiesMap<T, TKey>>(
                (result, currentId) => {
                    result[currentId] = state.entities[currentId]
                    return result
                },
                {},
            ),
        }
    }

    //
    // ADAPTER
    //

    export type AdapterSortFn<T, TState> = (entityLeft: T, entityRight: T, state: TState) => number

    export type Adapter<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>> = {
            addAll: (entities: T[], state: TState) => TState
            addMany: (entities: T[], state: TState) => TState
            upsertMany: (entities: T[], state: TState) => TState
            addOne: (entity: T, state: TState) => TState
            updateOne: (payload: EntityUpdate<T, TKey>, state: TState) => TState
            updateMany: (payload: EntityUpdate<T, TKey>[], state: TState) => TState
            removeOne: (id: TKey, state: TState) => TState
            removeMany: (ids: TKey[], state: TState) => TState
            selectIdFn: SelectIdFn<T, TKey>
            sortFn?: AdapterSortFn<T, TState>
        }

    export type AdapterOptions<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>> = {
            selectIdFn?: SelectIdFn<T, TKey>
            sortFn?: AdapterSortFn<T, TState>
        }

    export function getDefaultAdapterOptions<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(): AdapterOptions<T, TKey, TState> {
        return {
            selectIdFn: (entity: T) => defaultSelectIdFn<T, TKey>(entity),
        }
    }

    export function createAdapter<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(
        options?: AdapterOptions<T, TKey, TState>,
    ): Adapter<T, TKey, TState> {

        const adapterOptions: AdapterOptions<T, TKey, TState> = {
            ...getDefaultAdapterOptions<T, TKey, TState>(),
            ...options,
        }

        return {
            addAll: (entities: T[], state: TState) => {
                const newState = addAll<T, TKey, TState>(entities, state, adapterOptions.selectIdFn)
                return applySorting<T, TKey, TState>(newState, adapterOptions.sortFn)
            },
            addMany: (entities: T[], state: TState) => {
                const newState = addMany<T, TKey, TState>(entities, state, adapterOptions.selectIdFn)
                return applySorting<T, TKey, TState>(newState, adapterOptions.sortFn)
            },
            addOne: (entity: T, state: TState) => {
                const newState = addOne<T, TKey, TState>(entity, state, adapterOptions.selectIdFn)
                return applySorting<T, TKey, TState>(newState, adapterOptions.sortFn)
            },
            updateOne: (payload: EntityUpdate<T, TKey>, state: TState) => {
                const newState = updateOne<T, TKey, TState>(payload, state)
                return applySorting<T, TKey, TState>(newState, adapterOptions.sortFn)
            },
            updateMany: (payload: EntityUpdate<T, TKey>[], state: TState) => {
                const newState = updateMany<T, TKey, TState>(payload, state)
                return applySorting<T, TKey, TState>(newState, adapterOptions.sortFn)
            },
            upsertMany: (entities: T[], state: TState) => {
                const newState = upsertMany<T, TKey, TState>(entities, state, adapterOptions.selectIdFn)
                return applySorting<T, TKey, TState>(newState, adapterOptions.sortFn)
            },
            removeOne: (id: TKey, state: TState) => removeOne<T, TKey, TState>(id, state),
            removeMany: (ids: TKey[], state: TState) => removeMany<T, TKey, TState>(ids, state),
            selectIdFn: adapterOptions.selectIdFn!,
            sortFn: adapterOptions.sortFn,
        }
    }

    function applySorting<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(
        state: TState,
        sortFn?: AdapterSortFn<T, TState>,
    ): TState {
        if (!sortFn) {
            return state
        }

        const sortedIds = [...state.ids]
            .sort(
                (a: TKey, b: TKey) => sortFn(selectOne<T, TKey, TState>(a, state)!, selectOne<T, TKey, TState>(b, state)!, state),
            )
        return {
            ...state,
            ids: sortedIds,
        }

    }

    // SELECTORS

    export function selectAll<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(state: TState): T[] {
        return state.ids.map(id => state.entities[id]!)
    }

    export function selectByIds<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(state: TState, ids: TKey[]): T[] {
        return ids.map(id => state.entities[id]!)
    }

    export function selectOne<T extends BaseEntity, TKey extends EntityId = number,
        TState extends EntityState<T, TKey> = EntityState<T, TKey>>(
        id: TKey, state: TState): T | undefined {
        return state.entities[id]
    }

}
