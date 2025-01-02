/**
 * @fileoverview 404 Not Found page component with cultural sensitivity,
 * accessibility support, and RTL layout capabilities
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material'; // v5.14.0
import { ErrorOutline } from '@mui/icons-material'; // v5.14.0
import { useTranslation } from 'react-i18next'; // v12.0.0

import MainLayout from '../components/layout/MainLayout';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';

/**
 * Enhanced 404 Not Found page component with cultural sensitivity
 * and comprehensive accessibility support
 */
const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  /**
   * Handle navigation back to home page with analytics tracking
   */
  const handleGoHome = useCallback(() => {
    // Track 404 error in analytics
    if (window.gtag) {
      window.gtag('event', 'error_404', {
        error_page: window.location.pathname,
        referrer: document.referrer,
        language: i18n.language
      });
    }
    
    navigate('/');
  }, [navigate]);

  return (
    <MainLayout
      disableSidebar={true}
      maxWidth="sm"
    >
      <PageHeader
        title={t('errors.notFound.title')}
        subtitle={t('errors.notFound.subtitle')}
      />

      <EmptyState
        icon={
          <ErrorOutline
            sx={{
              fontSize: '64px',
              color: 'error.main'
            }}
            aria-hidden="true"
          />
        }
        message={t('errors.notFound.message')}
        action={
          <Button
            variant="contained"
            color="primary"
            onClick={handleGoHome}
            size="large"
            sx={{
              minWidth: 200,
              mt: 2,
              direction: isRTL ? 'rtl' : 'ltr'
            }}
            aria-label={t('errors.notFound.returnHome')}
          >
            {t('errors.notFound.returnHome')}
          </Button>
        }
        className="not-found-state"
      />
    </MainLayout>
  );
};

// Display name for debugging
NotFoundPage.displayName = 'NotFoundPage';

export default NotFoundPage;