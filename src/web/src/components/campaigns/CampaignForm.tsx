import React, { useCallback, useEffect, useState } from 'react';
import { 
  TextField, 
  Button, 
  Switch, 
  FormControlLabel, 
  Grid, 
  Tooltip,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { useTranslation } from 'react-i18next';
import { ICampaign, ICampaignLotteryDetails } from '../../interfaces/campaign.interface';
import { campaignSchema } from '../../validators/campaign.validator';
import useForm from '../../hooks/useForm';
import FileUpload from '../common/FileUpload';

interface CampaignFormProps {
  initialValues: Partial<ICampaign>;
  onSubmit: (campaign: ICampaign) => Promise<void>;
  isEdit: boolean;
  autoSave?: boolean;
}

const CampaignForm: React.FC<CampaignFormProps> = ({
  initialValues,
  onSubmit,
  isEdit,
  autoSave = true
}) => {
  const { t } = useTranslation();
  const [imageUploading, setImageUploading] = useState(false);

  // Default values for new campaign
  const defaultValues: ICampaign = {
    id: '',
    title: '',
    description: '',
    goalAmount: 0,
    minimumDonationAmount: 0,
    currency: 'USD',
    visibility: 'public',
    shareableUrl: '',
    socialShareText: '',
    categories: [],
    images: [],
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    associationId: '',
    currentAmount: 0,
    donorCount: 0,
    isLottery: false,
    lotteryDetails: null,
    status: 'draft'
  };

  // Initialize form with validation and auto-save
  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    isValid,
    isRTL
  } = useForm<ICampaign>(
    { ...defaultValues, ...initialValues },
    campaignSchema,
    onSubmit,
    {
      enableAutosave: autoSave,
      autosaveInterval: 30000,
      validateOnChange: true,
      validateOnBlur: true
    }
  );

  // Handle lottery toggle with validation
  const handleLotteryToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const isLottery = event.target.checked;
    setFieldValue('isLottery', isLottery);
    
    if (isLottery) {
      const defaultLotteryDetails: ICampaignLotteryDetails = {
        drawDate: new Date(values.endDate),
        ticketPrice: 0,
        currency: values.currency,
        maxTickets: 1000,
        ticketsSold: 0,
        remainingTickets: 1000,
        winnerSelectionMethod: 'random',
        termsAndConditions: '',
        prizes: []
      };
      setFieldValue('lotteryDetails', defaultLotteryDetails);
    } else {
      setFieldValue('lotteryDetails', null);
    }
  }, [setFieldValue, values.endDate, values.currency]);

  // Handle image upload with security checks
  const handleImageUpload = useCallback(async (file: File, url: string, metadata: any) => {
    setImageUploading(true);
    try {
      const newImage = {
        url,
        altText: file.name,
        ariaLabel: `Campaign image - ${file.name}`
      };
      setFieldValue('images', [...values.images, newImage]);
    } catch (error) {
      console.error('Image upload error:', error);
    } finally {
      setImageUploading(false);
    }
  }, [setFieldValue, values.images]);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ mt: 2 }}
      dir={isRTL ? 'rtl' : 'ltr'}
      role="form"
      aria-label={t('campaign.form.label')}
    >
      <Grid container spacing={3}>
        {/* Basic Campaign Information */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            {t('campaign.form.basicInfo')}
          </Typography>
          
          <TextField
            fullWidth
            required
            id="title"
            name="title"
            label={t('campaign.form.title')}
            value={values.title}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.title && !!errors.title}
            helperText={touched.title && errors.title?.[0]}
            margin="normal"
            inputProps={{
              'aria-label': t('campaign.form.title'),
              'aria-required': 'true',
              dir: isRTL ? 'rtl' : 'ltr'
            }}
          />

          <TextField
            fullWidth
            required
            multiline
            rows={4}
            id="description"
            name="description"
            label={t('campaign.form.description')}
            value={values.description}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.description && !!errors.description}
            helperText={touched.description && errors.description?.[0]}
            margin="normal"
            inputProps={{
              'aria-label': t('campaign.form.description'),
              'aria-required': 'true',
              dir: isRTL ? 'rtl' : 'ltr'
            }}
          />
        </Grid>

        {/* Financial Details */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            required
            type="number"
            id="goalAmount"
            name="goalAmount"
            label={t('campaign.form.goalAmount')}
            value={values.goalAmount}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.goalAmount && !!errors.goalAmount}
            helperText={touched.goalAmount && errors.goalAmount?.[0]}
            InputProps={{
              startAdornment: values.currency,
              inputProps: { min: 0 }
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            required
            select
            id="currency"
            name="currency"
            label={t('campaign.form.currency')}
            value={values.currency}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.currency && !!errors.currency}
            helperText={touched.currency && errors.currency?.[0]}
            SelectProps={{
              native: true
            }}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="ILS">ILS</option>
          </TextField>
        </Grid>

        {/* Campaign Dates */}
        <Grid item xs={12} md={6}>
          <DatePicker
            label={t('campaign.form.startDate')}
            value={values.startDate}
            onChange={(date) => setFieldValue('startDate', date)}
            slotProps={{
              textField: {
                fullWidth: true,
                error: touched.startDate && !!errors.startDate,
                helperText: touched.startDate && errors.startDate?.[0]
              }
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <DatePicker
            label={t('campaign.form.endDate')}
            value={values.endDate}
            onChange={(date) => setFieldValue('endDate', date)}
            slotProps={{
              textField: {
                fullWidth: true,
                error: touched.endDate && !!errors.endDate,
                helperText: touched.endDate && errors.endDate?.[0]
              }
            }}
          />
        </Grid>

        {/* Campaign Images */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            {t('campaign.form.images')}
          </Typography>
          <FileUpload
            onFileUpload={handleImageUpload}
            onError={(error) => console.error('File upload error:', error)}
            acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
            maxSize={5 * 1024 * 1024} // 5MB
            isSecure={true}
            multiple={true}
          />
        </Grid>

        {/* Lottery Settings */}
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={values.isLottery}
                onChange={handleLotteryToggle}
                name="isLottery"
              />
            }
            label={t('campaign.form.enableLottery')}
          />
        </Grid>

        {values.isLottery && (
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              {t('campaign.form.lotteryDetails')}
            </Typography>
            
            {/* Lottery-specific fields */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  name="lotteryDetails.ticketPrice"
                  label={t('campaign.form.ticketPrice')}
                  value={values.lotteryDetails?.ticketPrice}
                  onChange={handleChange}
                  error={touched.lotteryDetails?.ticketPrice && !!errors.lotteryDetails?.ticketPrice}
                  helperText={touched.lotteryDetails?.ticketPrice && errors.lotteryDetails?.ticketPrice?.[0]}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  name="lotteryDetails.maxTickets"
                  label={t('campaign.form.maxTickets')}
                  value={values.lotteryDetails?.maxTickets}
                  onChange={handleChange}
                  error={touched.lotteryDetails?.maxTickets && !!errors.lotteryDetails?.maxTickets}
                  helperText={touched.lotteryDetails?.maxTickets && errors.lotteryDetails?.maxTickets?.[0]}
                />
              </Grid>
            </Grid>
          </Grid>
        )}

        {/* Form Actions */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSubmitting || !isValid || imageUploading}
              aria-label={t('campaign.form.submit')}
            >
              {isEdit ? t('campaign.form.update') : t('campaign.form.create')}
            </Button>
          </Box>
        </Grid>
      </Grid>

      {/* Form-level error messages */}
      {Object.keys(errors).length > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('campaign.form.errors.validation')}
        </Alert>
      )}
    </Box>
  );
};

export default CampaignForm;