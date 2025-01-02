import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Switch,
  FormControlLabel,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import { IAssociation, IAssociationStatus } from '../../interfaces/association.interface';
import associationValidationSchema from '../../validators/association.validator';
import useForm from '../../hooks/useForm';

// Constants
const SUPPORTED_LANGUAGES = ['en', 'he', 'fr'] as const;
const SUPPORTED_COUNTRIES = ['IL', 'US', 'FR', 'GB'] as const;
const AUTO_SAVE_INTERVAL = 30000;

interface IAssociationFormProps {
  initialData?: IAssociation;
  onSubmit: (data: IAssociation) => Promise<void>;
  isLoading?: boolean;
  draftId?: string;
}

const AssociationForm: React.FC<IAssociationFormProps> = React.memo(({
  initialData,
  onSubmit,
  isLoading = false,
  draftId
}) => {
  const { t } = useTranslation();
  const [showPaymentConfig, setShowPaymentConfig] = useState(false);

  // Initialize form with useForm hook
  const {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid,
    isRTL,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    resetForm,
    saveDraft,
    loadDraft
  } = useForm<IAssociation>(
    initialData || {
      id: '',
      name: SUPPORTED_LANGUAGES.reduce((acc, lang) => ({ ...acc, [lang]: '' }), {}),
      description: SUPPORTED_LANGUAGES.reduce((acc, lang) => ({ ...acc, [lang]: '' }), {}),
      email: '',
      phone: '',
      website: '',
      socialMedia: {},
      address: {
        street: '',
        city: '',
        state: '',
        country: 'IL',
        postalCode: '',
        coordinates: { latitude: 0, longitude: 0 }
      },
      legalInfo: {
        registrationNumber: '',
        taxId: '',
        registrationDate: new Date(),
        registrationCountry: 'IL',
        legalStatus: '',
        complianceDocuments: []
      },
      categories: [],
      primaryLanguage: 'he',
      supportedLanguages: ['he', 'en'],
      paymentGateways: {
        stripe: {
          accountId: '',
          enabled: false,
          capabilities: [],
          currencies: ['USD', 'EUR']
        },
        tranzilla: {
          terminalId: '',
          enabled: false,
          merchantId: '',
          supportedCards: []
        },
        defaultGateway: 'stripe',
        supportedCurrencies: ['USD', 'ILS', 'EUR']
      },
      isVerified: false,
      verificationDetails: {
        lastVerified: new Date(),
        verifiedBy: '',
        documents: []
      },
      status: IAssociationStatus.PENDING,
      settings: {
        autoApprovalThreshold: 1000,
        defaultCurrency: 'ILS',
        notificationPreferences: {}
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    associationValidationSchema,
    onSubmit,
    {
      enableAutosave: true,
      autosaveInterval: AUTO_SAVE_INTERVAL,
      enableDraftManagement: true,
      validateOnChange: true,
      validateOnBlur: true,
      locale: values?.primaryLanguage || 'he'
    }
  );

  // Load draft on mount if draftId is provided
  useEffect(() => {
    if (draftId) {
      loadDraft();
    }
  }, [draftId, loadDraft]);

  // Handle form submission
  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !isSubmitting) {
      await handleSubmit(e);
    }
  }, [isValid, isSubmitting, handleSubmit]);

  // Render multi-language text fields
  const renderMultiLanguageField = useCallback((
    fieldName: 'name' | 'description',
    label: string,
    multiline = false
  ) => (
    <Grid container spacing={2}>
      {SUPPORTED_LANGUAGES.map(lang => (
        <Grid item xs={12} md={4} key={`${fieldName}-${lang}`}>
          <TextField
            fullWidth
            multiline={multiline}
            rows={multiline ? 4 : 1}
            name={`${fieldName}.${lang}`}
            label={`${label} (${lang.toUpperCase()})`}
            value={values[fieldName][lang]}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[`${fieldName}.${lang}`] && !!errors[`${fieldName}.${lang}`]}
            helperText={touched[`${fieldName}.${lang}`] && errors[`${fieldName}.${lang}`]}
            dir={lang === 'he' ? 'rtl' : 'ltr'}
          />
        </Grid>
      ))}
    </Grid>
  ), [values, touched, errors, handleChange, handleBlur]);

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <form onSubmit={handleFormSubmit}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              {t('association.form.basicInfo')}
            </Typography>
            {renderMultiLanguageField('name', t('association.form.name'))}
            {renderMultiLanguageField('description', t('association.form.description'), true)}
          </Grid>

          {/* Contact Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              {t('association.form.contactInfo')}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  name="email"
                  label={t('association.form.email')}
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.email && !!errors.email}
                  helperText={touched.email && errors.email}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  name="phone"
                  label={t('association.form.phone')}
                  value={values.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.phone && !!errors.phone}
                  helperText={touched.phone && errors.phone}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  name="website"
                  label={t('association.form.website')}
                  value={values.website}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.website && !!errors.website}
                  helperText={touched.website && errors.website}
                />
              </Grid>
            </Grid>
          </Grid>

          {/* Address Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              {t('association.form.address')}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="address.street"
                  label={t('association.form.street')}
                  value={values.address.street}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched['address.street'] && !!errors['address.street']}
                  helperText={touched['address.street'] && errors['address.street']}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="address.city"
                  label={t('association.form.city')}
                  value={values.address.city}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched['address.city'] && !!errors['address.city']}
                  helperText={touched['address.city'] && errors['address.city']}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth error={touched['address.country'] && !!errors['address.country']}>
                  <InputLabel>{t('association.form.country')}</InputLabel>
                  <Select
                    name="address.country"
                    value={values.address.country}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  >
                    {SUPPORTED_COUNTRIES.map(country => (
                      <MenuItem key={country} value={country}>
                        {t(`countries.${country}`)}
                      </MenuItem>
                    ))}
                  </Select>
                  {touched['address.country'] && errors['address.country'] && (
                    <FormHelperText>{errors['address.country']}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
            </Grid>
          </Grid>

          {/* Payment Gateway Configuration */}
          <Grid item xs={12}>
            <Box display="flex" alignItems="center" mb={2}>
              <Typography variant="h6">
                {t('association.form.paymentConfig')}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={showPaymentConfig}
                    onChange={(e) => setShowPaymentConfig(e.target.checked)}
                  />
                }
                label={t('association.form.showPaymentConfig')}
                sx={{ ml: 2 }}
              />
            </Box>
            {showPaymentConfig && (
              <Grid container spacing={2}>
                {/* Stripe Configuration */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="paymentGateways.stripe.accountId"
                    label={t('association.form.stripeAccountId')}
                    value={values.paymentGateways.stripe.accountId}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched['paymentGateways.stripe.accountId'] && !!errors['paymentGateways.stripe.accountId']}
                    helperText={touched['paymentGateways.stripe.accountId'] && errors['paymentGateways.stripe.accountId']}
                  />
                </Grid>
                {/* Tranzilla Configuration */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="paymentGateways.tranzilla.terminalId"
                    label={t('association.form.tranzillaTerminalId')}
                    value={values.paymentGateways.tranzilla.terminalId}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched['paymentGateways.tranzilla.terminalId'] && !!errors['paymentGateways.tranzilla.terminalId']}
                    helperText={touched['paymentGateways.tranzilla.terminalId'] && errors['paymentGateways.tranzilla.terminalId']}
                  />
                </Grid>
              </Grid>
            )}
          </Grid>

          {/* Form Actions */}
          <Grid item xs={12}>
            <Box display="flex" justifyContent="space-between" mt={3}>
              <Button
                variant="outlined"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                {t('common.reset')}
              </Button>
              <Box>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={!isValid || isSubmitting}
                  sx={{ ml: 2 }}
                >
                  {isSubmitting ? (
                    <CircularProgress size={24} />
                  ) : (
                    t('common.submit')
                  )}
                </Button>
              </Box>
            </Box>
          </Grid>

          {/* Form Status */}
          {isDirty && (
            <Grid item xs={12}>
              <Alert severity="info">
                {t('common.unsavedChanges')}
              </Alert>
            </Grid>
          )}
        </Grid>
      </form>
    </Paper>
  );
});

AssociationForm.displayName = 'AssociationForm';

export default AssociationForm;