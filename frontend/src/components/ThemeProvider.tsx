import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeMode } from 'shared/types';

type ThemeProviderProps = {
  children: React.ReactNode;
  initialTheme?: ThemeMode;
  initialFontFamily?: string | null;
  initialUseGoogleFonts?: boolean;
  initialUseNerdFonts?: boolean;
};

type ThemeProviderState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  fontFamily: string | null;
  setFontFamily: (fontFamily: string | null) => void;
  useGoogleFonts: boolean;
  setUseGoogleFonts: (useGoogleFonts: boolean) => void;
  useNerdFonts: boolean;
  setUseNerdFonts: (useNerdFonts: boolean) => void;
};

const initialState: ThemeProviderState = {
  theme: ThemeMode.SYSTEM,
  setTheme: () => null,
  fontFamily: null,
  setFontFamily: () => null,
  useGoogleFonts: true,
  setUseGoogleFonts: () => null,
  useNerdFonts: true,
  setUseNerdFonts: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  initialTheme = ThemeMode.SYSTEM,
  initialFontFamily = null,
  initialUseGoogleFonts = true,
  initialUseNerdFonts = true,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);
  const [fontFamily, setFontFamilyState] = useState<string | null>(
    initialFontFamily
  );
  const [useGoogleFonts, setUseGoogleFontsState] = useState<boolean>(
    initialUseGoogleFonts
  );
  const [useNerdFonts, setUseNerdFontsState] = useState<boolean>(
    initialUseNerdFonts
  );

  // Update theme when initialTheme changes
  useEffect(() => {
    setThemeState(initialTheme);
  }, [initialTheme]);

  // Update font family when initialFontFamily changes
  useEffect(() => {
    setFontFamilyState(initialFontFamily);
  }, [initialFontFamily]);

  // Update use google fonts when initialUseGoogleFonts changes
  useEffect(() => {
    setUseGoogleFontsState(initialUseGoogleFonts);
  }, [initialUseGoogleFonts]);

  // Update use nerd fonts when initialUseNerdFonts changes
  useEffect(() => {
    setUseNerdFontsState(initialUseNerdFonts);
  }, [initialUseNerdFonts]);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === ThemeMode.SYSTEM) {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme.toLowerCase());
  }, [theme]);

  // aplicar la fuente personalizada al body y a .legacy-design
  useEffect(() => {
    const body = window.document.body;
    const legacyDesign = document.querySelector('.legacy-design') as HTMLElement;

    if (fontFamily) {
      body.style.setProperty('font-family', fontFamily, 'important');
      if (legacyDesign) {
        legacyDesign.style.setProperty('font-family', fontFamily, 'important');
      }
    } else {
      // eliminar el estilo inline para volver a usar la fuente del tailwind config
      body.style.removeProperty('font-family');
      if (legacyDesign) {
        legacyDesign.style.removeProperty('font-family');
      }
    }
  }, [fontFamily]);

  // cargar o descargar Google Fonts dinámicamente
  useEffect(() => {
    const FONT_LINK_ID = 'google-fonts-chivo-mono';
    const FONT_URL =
      'https://fonts.googleapis.com/css2?family=Chivo+Mono:ital,wght@0,100..900;1,100..900&family=Noto+Emoji:wght@300..700&display=swap';

    if (useGoogleFonts) {
      // verificar si ya existe el link
      if (!document.getElementById(FONT_LINK_ID)) {
        const link = document.createElement('link');
        link.id = FONT_LINK_ID;
        link.rel = 'stylesheet';
        link.href = FONT_URL;
        document.head.appendChild(link);
      }
    } else {
      // eliminar el link si existe
      const existingLink = document.getElementById(FONT_LINK_ID);
      if (existingLink) {
        existingLink.remove();
      }
    }
  }, [useGoogleFonts]);

  // cargar o descargar Nerd Fonts Symbols dinámicamente
  useEffect(() => {
    const FONT_LINK_ID = 'nerd-fonts-symbols';
    const FONT_URL = '/css/nerd-fonts.css';

    if (useNerdFonts) {
      // verificar si ya existe el link
      if (!document.getElementById(FONT_LINK_ID)) {
        const link = document.createElement('link');
        link.id = FONT_LINK_ID;
        link.rel = 'stylesheet';
        link.href = FONT_URL;
        document.head.appendChild(link);
      }
    } else {
      // eliminar el link si existe
      const existingLink = document.getElementById(FONT_LINK_ID);
      if (existingLink) {
        existingLink.remove();
      }
    }
  }, [useNerdFonts]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  const setFontFamily = (newFontFamily: string | null) => {
    setFontFamilyState(newFontFamily);
  };

  const setUseGoogleFonts = (newUseGoogleFonts: boolean) => {
    setUseGoogleFontsState(newUseGoogleFonts);
  };

  const setUseNerdFonts = (newUseNerdFonts: boolean) => {
    setUseNerdFontsState(newUseNerdFonts);
  };

  const value = {
    theme,
    setTheme,
    fontFamily,
    setFontFamily,
    useGoogleFonts,
    setUseGoogleFonts,
    useNerdFonts,
    setUseNerdFonts,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
