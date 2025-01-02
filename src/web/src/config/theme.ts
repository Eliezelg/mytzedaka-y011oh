// @mui/material v5.14.0
import { createTheme, Theme, ThemeOptions } from '@mui/material';

// Global constants
const FONT_FAMILY = '"Assistant", system-ui, -apple-system, sans-serif';
const HEBREW_FONT_FAMILY = '"Assistant", system-ui, -apple-system, sans-serif';
const SPACING_UNIT = 8;
const BORDER_RADIUS = 4;
const THEME_TRANSITION_DURATION = 300;

// Cultural color palette based on traditional Jewish symbolism
const culturalColors = {
  blue: {
    light: '#4B9FE1', // Represents spirituality and divine wisdom
    main: '#0A4B91', // Traditional tekhelet blue
    dark: '#063264',
  },
  gold: {
    light: '#FFD95D', // Represents the Temple's glory
    main: '#C5A028', // Traditional Temple gold
    dark: '#8B7355',
  },
  white: {
    main: '#FFFFFF', // Represents purity
    off: '#F7F7F7',
  },
  silver: {
    light: '#E5E5E5', // Represents divine redemption
    main: '#C0C0C0',
    dark: '#808080',
  }
};

// Create base theme configuration with cultural customizations
const createBaseTheme = (mode: 'light' | 'dark', direction: 'ltr' | 'rtl'): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      light: culturalColors.blue.light,
      main: culturalColors.blue.main,
      dark: culturalColors.blue.dark,
      contrastText: culturalColors.white.main,
    },
    secondary: {
      light: culturalColors.gold.light,
      main: culturalColors.gold.main,
      dark: culturalColors.gold.dark,
      contrastText: culturalColors.white.main,
    },
    cultural: {
      primary: culturalColors.blue.main,
      secondary: culturalColors.gold.main,
      accent: culturalColors.silver.main,
    },
    background: {
      default: mode === 'light' ? culturalColors.white.off : '#121212',
      paper: mode === 'light' ? culturalColors.white.main : '#1E1E1E',
      cultural: mode === 'light' ? culturalColors.blue.light : culturalColors.blue.dark,
    },
    text: {
      primary: mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'rgba(255, 255, 255, 0.87)',
      secondary: mode === 'light' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)',
      cultural: culturalColors.blue.main,
    },
  },
  typography: {
    fontFamily: FONT_FAMILY,
    hebrewFontFamily: HEBREW_FONT_FAMILY,
    fontSize: 16,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: {
      fontFamily: direction === 'rtl' ? HEBREW_FONT_FAMILY : FONT_FAMILY,
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontFamily: direction === 'rtl' ? HEBREW_FONT_FAMILY : FONT_FAMILY,
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h3: {
      fontFamily: direction === 'rtl' ? HEBREW_FONT_FAMILY : FONT_FAMILY,
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontFamily: direction === 'rtl' ? HEBREW_FONT_FAMILY : FONT_FAMILY,
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontFamily: direction === 'rtl' ? HEBREW_FONT_FAMILY : FONT_FAMILY,
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontFamily: direction === 'rtl' ? HEBREW_FONT_FAMILY : FONT_FAMILY,
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    body1: {
      fontFamily: direction === 'rtl' ? HEBREW_FONT_FAMILY : FONT_FAMILY,
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontFamily: direction === 'rtl' ? HEBREW_FONT_FAMILY : FONT_FAMILY,
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      fontFamily: direction === 'rtl' ? HEBREW_FONT_FAMILY : FONT_FAMILY,
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  spacing: (factor: number) => `${SPACING_UNIT * factor}px`,
  shape: {
    borderRadius: BORDER_RADIUS,
    culturalBorderRadius: BORDER_RADIUS * 2,
  },
  direction,
  transitions: {
    themeSwitch: {
      duration: THEME_TRANSITION_DURATION,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
    directionSwitch: {
      duration: THEME_TRANSITION_DURATION,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          transition: `background-color ${THEME_TRANSITION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: BORDER_RADIUS * 2,
          padding: `${SPACING_UNIT}px ${SPACING_UNIT * 2}px`,
          minHeight: SPACING_UNIT * 5,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: BORDER_RADIUS,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: BORDER_RADIUS * 2,
        },
      },
    },
  },
});

// Create light theme
export const lightTheme: Theme = createTheme(createBaseTheme('light', 'ltr'));

// Create dark theme
export const darkTheme: Theme = createTheme(createBaseTheme('dark', 'ltr'));

// Create RTL light theme
export const lightThemeRTL: Theme = createTheme(createBaseTheme('light', 'rtl'));

// Create RTL dark theme
export const darkThemeRTL: Theme = createTheme(createBaseTheme('dark', 'rtl'));

// Type augmentation for custom theme properties
declare module '@mui/material/styles' {
  interface Palette {
    cultural: {
      primary: string;
      secondary: string;
      accent: string;
    };
  }
  interface PaletteOptions {
    cultural?: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
  }
  interface TypeBackground {
    cultural: string;
  }
  interface TypographyVariants {
    hebrewFontFamily: string;
  }
  interface TypographyVariantsOptions {
    hebrewFontFamily?: string;
  }
  interface Shape {
    culturalBorderRadius: number;
  }
}

// Type augmentation for custom component props
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    cultural: true;
  }
}