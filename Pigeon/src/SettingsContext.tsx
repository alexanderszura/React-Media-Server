import { createContext, useContext, useEffect, useState } from "react";

interface Settings {
    savePath: string | null;
    maxTitlesPerPage: number;
    enableRetroGames: boolean;
}

interface SettingsContextType {
    settings: Settings;
    isLoaded: boolean;
    setSavePath: (path: string) => Promise<void>;
    setMaxTitlePerPage: (num: number) => Promise<void>;
    setEnableRetroGames: (enabled: boolean) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [settings, setSettings] = useState<Settings>({
        savePath: null,
        maxTitlesPerPage: 10,
        enableRetroGames: false,
    });
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                // Load from localStorage instead of Tauri
                const saved = localStorage.getItem("pigeon-settings");
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setSettings({
                        savePath: parsed.savePath,
                        maxTitlesPerPage: parsed.maxTitlesPerPage ?? 10,
                        enableRetroGames: parsed.enableRetroGames ?? false,
                    });
                }
            } finally {
                setIsLoaded(true);
            }
        }

        load();
    }, []);

    async function updateSetting<K extends keyof Settings>(
        key: K,
        value: Settings[K]
    ) {
        const newSettings = {
            ...settings,
            [key]: value,
        };

        setSettings(newSettings);

        localStorage.setItem("pigeon-settings", JSON.stringify(newSettings));
    }

    const setSavePath = (path: string) =>
        updateSetting("savePath", path);

    const setMaxTitlePerPage = (num: number) =>
        updateSetting("maxTitlesPerPage", num);

    const setEnableRetroGames = (enabled: boolean) =>
        updateSetting("enableRetroGames", enabled);

    return (
        <SettingsContext.Provider
            value={{
                settings,
                isLoaded,
                setSavePath,
                setMaxTitlePerPage,
                setEnableRetroGames,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);

    if (!context) {
        throw new Error("useSettings must be inside SettingsProvider");
    }

    return context;
}