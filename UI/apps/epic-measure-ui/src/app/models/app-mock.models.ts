export namespace AppMock {

    const STORAGE_KEY = 'epic.mockSettings'

    export type MockSettings = {
        useMockData: boolean
    }

    export function getDefaultMockSettings(): MockSettings {
        return {
            useMockData: false,
        }
    }

    export function getMockSettings(): MockSettings {
        try {
            const settingsStr = window.localStorage.getItem(STORAGE_KEY)
            return settingsStr === null
                ? getDefaultMockSettings()
                : JSON.parse(settingsStr) as MockSettings
        }
        catch (error) {
            console.error(error)
            return getDefaultMockSettings()
        }
    }

    export function saveMockSettings(settings: MockSettings): void {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    }

}

