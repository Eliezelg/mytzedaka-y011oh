/**
 * @fileoverview Settings page component providing user-configurable options
 * with enhanced RTL support and WCAG compliance
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material'; // v5.14.0
import { useTranslation } from 'react-i18next'; // v12.0.0

import MainLayout from '../components/layout/MainLayout';
import LanguageSelector from '../components/layout/LanguageSelector';
import ThemeToggle from '../components/layout/ThemeToggle';
import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../hooks/useAuth';
import useLanguage from '../hooks/useLanguage';

// Interface for settings section configuration
interface SettingsSection {
  title: string;
  content: React.ReactNode;
  ariaLabel: string;
}

/**
 * Enhanced settings page component with accessibility and RTL support
 */
const SettingsPage: React.FC = React.memo(() => {
  const { t, i18n } = useTranslation();
  const { isRTL, currentLanguage } = useLanguage();
  const { user, deviceTrusted, revokeDeviceTrust } = useAuth();

  // Settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        // Load preferences from backend (implementation pending)
        setLoading(false);
      } catch (err) {
        setError(t('settings.errors.loadFailed'));
        setLoading(false);
      }
    };

    loadPreferences();
  }, [t]);

  // Handle preference changes with debounced save
  const handlePreferenceChange = useCallback(async (
    key: string,
    value: boolean
  ) => {
    try {
      setError(null);
      switch (key) {
        case 'emailNotifications':
          setEmailNotifications(value);
          break;
        case 'smsNotifications':
          setSmsNotifications(value);
          break;
        case 'highContrastMode':
          setHighContrastMode(value);
          break;
        case 'reducedMotion':
          setReducedMotion(value);
          break;
      }
      // Save preferences to backend (implementation pending)
    } catch (err) {
      setError(t('settings.errors.saveFailed'));
    }
  }, [t]);

  // Handle device trust revocation
  const handleRevokeDeviceTrust = useCallback(async () => {
    try {
      setError(null);
      await revokeDeviceTrust();
    } catch (err) {
      setError(t('settings.errors.revokeFailed'));
    }
  }, [revokeDeviceTrust, t]);

  // Settings sections configuration
  const sections: SettingsSection[] = [
    {
      title: t('settings.sections.language'),
      ariaLabel: t('settings.aria.language'),
      content: (
        <Box sx={styles.settingItem}>
          <Typography>{t('settings.language.select')}</Typography>
          <LanguageSelector />
        </Box>
      )
    },
    {
      title: t('settings.sections.appearance'),
      ariaLabel: t('settings.aria.appearance'),
      content: (
        <>
          <Box sx={styles.settingItem}>
            <Typography>{t('settings.appearance.theme')}</Typography>
            <ThemeToggle />
          </Box>
          <Box sx={styles.settingItem}>
            <FormControlLabel
              control={
                <Switch
                  checked={highContrastMode}
                  onChange={(e) => handlePreferenceChange('highContrastMode', e.target.checked)}
                  name="highContrastMode"
                />
              }
              label={t('settings.appearance.highContrast')}
            />
          </Box>
          <Box sx={styles.settingItem}>
            <FormControlLabel
              control={
                <Switch
                  checked={reducedMotion}
                  onChange={(e) => handlePreferenceChange('reducedMotion', e.target.checked)}
                  name="reducedMotion"
                />
              }
              label={t('settings.appearance.reducedMotion')}
            />
          </Box>
        </>
      )
    },
    {
      title: t('settings.sections.notifications'),
      ariaLabel: t('settings.aria.notifications'),
      content: (
        <>
          <Box sx={styles.settingItem}>
            <FormControlLabel
              control={
                <Switch
                  checked={emailNotifications}
                  onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
                  name="emailNotifications"
                />
              }
              label={t('settings.notifications.email')}
            />
          </Box>
          <Box sx={styles.settingItem}>
            <FormControlLabel
              control={
                <Switch
                  checked={smsNotifications}
                  onChange={(e) => handlePreferenceChange('smsNotifications', e.target.checked)}
                  name="smsNotifications"
                />
              }
              label={t('settings.notifications.sms')}
            />
          </Box>
        </>
      )
    },
    {
      title: t('settings.sections.security'),
      ariaLabel: t('settings.aria.security'),
      content: (
        <Box sx={styles.settingItem}>
          <Typography>
            {deviceTrusted
              ? t('settings.security.deviceTrusted')
              : t('settings.security.deviceNotTrusted')}
          </Typography>
          {deviceTrusted && (
            <button
              onClick={handleRevokeDeviceTrust}
              aria-label={t('settings.aria.revokeTrust')}
            >
              {t('settings.security.revokeTrust')}
            </button>
          )}
        </Box>
      )
    }
  ];

  return (
    <MainLayout>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          padding: 3,
          direction: isRTL ? 'rtl' : 'ltr'
        }}
      >
        <PageHeader
          title={t('settings.title')}
          subtitle={t('settings.subtitle')}
        />

        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ marginBottom: 2 }}
          >
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {sections.map((section, index) => (
            <Grid item xs={12} key={index}>
              <Card sx={styles.card}>
                <CardContent>
                  <Typography
                    variant="h6"
                    gutterBottom
                    component="h2"
                    aria-label={section.ariaLabel}
                  >
                    {section.title}
                  </Typography>
                  <Divider sx={styles.divider} />
                  {section.content}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {loading && (
          <Box sx={styles.loadingOverlay}>
            <Typography>{t('settings.loading')}</Typography>
          </Box>
        )}
      </Box>
    </MainLayout>
  );
});

// Styles
const styles = {
  section: {
    marginBottom: 3,
    position: 'relative'
  },
  card: {
    height: '100%',
    transition: 'all 0.3s ease'
  },
  divider: {
    margin: '16px 0',
    opacity: 0.8
  },
  settingItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    minHeight: '48px'
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 1
  }
};

// Display name for debugging
SettingsPage.displayName = 'SettingsPage';

export default SettingsPage;