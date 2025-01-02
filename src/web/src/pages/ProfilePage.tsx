/**
 * @fileoverview ProfilePage component for managing user profile display and editing
 * with comprehensive support for internationalization, RTL layouts, and accessibility
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { Container, Box, useTheme, Snackbar, Alert, CircularProgress } from '@mui/material';
import { useSnackbar } from 'notistack';

// Internal imports
import ProfileView from '../components/profile/ProfileView';
import ProfileForm from '../components/profile/ProfileForm';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { UserProfile } from '../interfaces/user.interface';

/**
 * ProfilePage component with enhanced error handling and accessibility
 */
const ProfilePage: React.FC = memo(() => {
  // Hooks
  const { user, isSessionValid } = useAuth();
  const { direction, locale } = useLanguage();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  // Local state
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Focus management for accessibility
  const [lastFocusedElement, setLastFocusedElement] = useState<HTMLElement | null>(null);

  /**
   * Handle session timeout
   */
  useEffect(() => {
    if (!isSessionValid) {
      enqueueSnackbar('Session expired. Please log in again.', {
        variant: 'error',
        anchorOrigin: { vertical: 'top', horizontal: 'center' }
      });
    }
  }, [isSessionValid, enqueueSnackbar]);

  /**
   * Initialize component with loading state
   */
  useEffect(() => {
    const initializeProfile = async () => {
      try {
        setIsLoading(true);
        // Simulate data loading delay
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load profile data');
        setIsLoading(false);
      }
    };

    initializeProfile();
  }, []);

  /**
   * Handle edit mode transition with accessibility considerations
   */
  const handleEditClick = useCallback(() => {
    if (!isSessionValid) {
      enqueueSnackbar('Please log in to edit your profile', { variant: 'warning' });
      return;
    }

    setLastFocusedElement(document.activeElement as HTMLElement);
    setIsEditing(true);
  }, [isSessionValid, enqueueSnackbar]);

  /**
   * Handle successful profile update
   */
  const handleEditSuccess = useCallback(async (updatedProfile: UserProfile) => {
    try {
      setIsEditing(false);
      enqueueSnackbar('Profile updated successfully', {
        variant: 'success',
        autoHideDuration: 3000,
        anchorOrigin: { vertical: 'top', horizontal: direction === 'rtl' ? 'left' : 'right' }
      });

      // Restore focus for accessibility
      if (lastFocusedElement) {
        lastFocusedElement.focus();
      }
    } catch (err) {
      setError('Failed to update profile');
      enqueueSnackbar('Failed to update profile', { variant: 'error' });
    }
  }, [direction, enqueueSnackbar, lastFocusedElement]);

  /**
   * Handle error states
   */
  const handleError = useCallback((error: Error) => {
    console.error('Profile error:', error);
    setError(error.message);
    enqueueSnackbar(error.message, { variant: 'error' });
  }, [enqueueSnackbar]);

  // Loading state
  if (isLoading) {
    return (
      <Container
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px'
        }}
      >
        <CircularProgress
          size={40}
          aria-label={locale === 'he' ? 'טוען...' : 'Loading...'}
        />
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container>
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mt: 2 }}
        >
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <ErrorBoundary>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          py: 3,
          direction: direction,
          backgroundColor: theme.palette.background.default
        }}
      >
        <Container maxWidth="lg">
          {isEditing && user ? (
            <ProfileForm
              initialData={{
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                preferredLanguage: user.preferredLanguage,
                recoveryEmail: user.recoveryEmail
              }}
              onSubmitSuccess={handleEditSuccess}
              enableAutoSave={true}
            />
          ) : (
            <ProfileView onEdit={handleEditClick} />
          )}
        </Container>
      </Box>
    </ErrorBoundary>
  );
});

// Display name for debugging
ProfilePage.displayName = 'ProfilePage';

export default ProfilePage;