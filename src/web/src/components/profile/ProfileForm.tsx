import React, { useCallback, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next'; // v13.0.0
import { TextField, Button, Grid, Box, Typography, Alert, CircularProgress } from '@mui/material'; // v5.14.0
import { useTheme } from '@mui/material/styles'; // v5.14.0
import InputMask from 'react-input-mask'; // v2.0.4

import { UserProfile } from '../../interfaces/user.interface';
import useForm from '../../hooks/useForm';
import { userProfileSchema } from '../../validators/user.validator';

// Props interface for the ProfileForm component
interface ProfileFormProps {
  initialData: UserProfile;
  onSubmitSuccess?: () => void;
  enableAutoSave?: boolean;
}

/**
 * Enhanced ProfileForm component with RTL support, accessibility features,
 * and comprehensive form validation
 */
const ProfileForm: React.FC<ProfileFormProps> = memo(({
  initialData,
  onSubmitSuccess,
  enableAutoSave = true
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // Initialize form with enhanced validation and auto-save
  const {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    locale,
    isRTL
  } = useForm<UserProfile>(
    initialData,
    userProfileSchema,
    async (data) => {
      try {
        // API call would go here
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated API call
        onSubmitSuccess?.();
      } catch (error) {
        console.error('Profile update failed:', error);
        throw error;
      }
    },
    {
      enableAutosave: enableAutoSave,
      autosaveInterval: 30000,
      validateOnChange: true,
      validateOnBlur: true,
      locale
    }
  );

  // Handle form direction based on language
  const formDirection = isRTL ? 'rtl' : 'ltr';

  // Phone number mask based on locale
  const getPhoneMask = useCallback(() => {
    switch (locale) {
      case 'he':
        return '+972 99 999 9999';
      case 'fr':
        return '+33 99 99 99 99 99';
      default:
        return '+1 999 999 9999';
    }
  }, [locale]);

  // Reset form when initial data changes
  useEffect(() => {
    resetForm();
  }, [initialData, resetForm]);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      dir={formDirection}
      sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}
    >
      <Grid container spacing={3}>
        {/* Form Header */}
        <Grid item xs={12}>
          <Typography variant="h5" component="h2" gutterBottom>
            {t('profile.form.title')}
          </Typography>
        </Grid>

        {/* First Name Field */}
        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            id="firstName"
            name="firstName"
            label={t('profile.form.firstName')}
            value={values.firstName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.firstName && Boolean(errors.firstName)}
            helperText={touched.firstName && errors.firstName?.[0]}
            disabled={isSubmitting}
            inputProps={{
              'aria-label': t('profile.form.firstName'),
              dir: isRTL ? 'rtl' : 'ltr'
            }}
          />
        </Grid>

        {/* Last Name Field */}
        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            id="lastName"
            name="lastName"
            label={t('profile.form.lastName')}
            value={values.lastName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.lastName && Boolean(errors.lastName)}
            helperText={touched.lastName && errors.lastName?.[0]}
            disabled={isSubmitting}
            inputProps={{
              'aria-label': t('profile.form.lastName'),
              dir: isRTL ? 'rtl' : 'ltr'
            }}
          />
        </Grid>

        {/* Phone Number Field */}
        <Grid item xs={12}>
          <InputMask
            mask={getPhoneMask()}
            value={values.phoneNumber || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
          >
            {(inputProps: any) => (
              <TextField
                {...inputProps}
                fullWidth
                id="phoneNumber"
                name="phoneNumber"
                label={t('profile.form.phoneNumber')}
                error={touched.phoneNumber && Boolean(errors.phoneNumber)}
                helperText={touched.phoneNumber && errors.phoneNumber?.[0]}
                inputProps={{
                  'aria-label': t('profile.form.phoneNumber')
                }}
              />
            )}
          </InputMask>
        </Grid>

        {/* Language Selection Field */}
        <Grid item xs={12}>
          <TextField
            select
            fullWidth
            id="preferredLanguage"
            name="preferredLanguage"
            label={t('profile.form.language')}
            value={values.preferredLanguage}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.preferredLanguage && Boolean(errors.preferredLanguage)}
            helperText={touched.preferredLanguage && errors.preferredLanguage?.[0]}
            disabled={isSubmitting}
            SelectProps={{
              native: true,
              'aria-label': t('profile.form.language')
            }}
          >
            <option value="en">English</option>
            <option value="he">עברית</option>
            <option value="fr">Français</option>
          </TextField>
        </Grid>

        {/* Auto-save Indicator */}
        {enableAutoSave && isDirty && (
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('profile.form.autoSaving')}
            </Alert>
          </Grid>
        )}

        {/* Form Actions */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
            <Button
              type="button"
              onClick={resetForm}
              disabled={!isDirty || isSubmitting}
              aria-label={t('common.reset')}
            >
              {t('common.reset')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={!isDirty || !isValid || isSubmitting}
              aria-label={t('common.save')}
              endIcon={isSubmitting && <CircularProgress size={20} />}
            >
              {t('common.save')}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
});

ProfileForm.displayName = 'ProfileForm';

export default ProfileForm;