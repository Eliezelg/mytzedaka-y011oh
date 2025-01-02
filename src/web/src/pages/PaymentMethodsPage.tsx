import React, { useState, useEffect, useCallback } from 'react'; // @version 18.2.0
import {
  Container,
  Grid,
  Paper,
  Button,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material'; // @version 5.14.0
import { Add, Payment } from '@mui/icons-material'; // @version 5.14.0
import { useTranslation } from 'react-i18next'; // @version 12.3.1

import PaymentMethodList from '../components/payments/PaymentMethodList';
import PaymentMethodForm from '../components/payments/PaymentMethodForm';
import { usePayments } from '../hooks/usePayments';
import { PaymentMethod, PaymentGateway } from '../interfaces/payment.interface';

interface PaymentMethodsPageProps {
  onPaymentMethodChange?: (method: PaymentMethod | null) => void;
}

/**
 * Payment Methods Page Component
 * Provides secure management of payment methods with dual gateway support (Stripe/Tranzilla)
 * Implements WCAG 2.1 Level AA accessibility standards and RTL support
 */
const PaymentMethodsPage: React.FC<PaymentMethodsPageProps> = ({
  onPaymentMethodChange
}) => {
  const { t } = useTranslation();
  const {
    paymentMethods,
    loading,
    error,
    addPaymentMethod,
    removePaymentMethod,
    fetchPaymentMethods
  } = usePayments();

  const [showForm, setShowForm] = useState<boolean>(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Load payment methods on component mount
  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  // Handle payment method selection
  const handleMethodSelect = useCallback((method: PaymentMethod | null) => {
    setSelectedMethod(method);
    onPaymentMethodChange?.(method);
  }, [onPaymentMethodChange]);

  // Handle new payment method addition
  const handlePaymentMethodAdded = useCallback(async (method: PaymentMethod) => {
    try {
      await addPaymentMethod(method);
      setShowForm(false);
      setSnackbar({
        open: true,
        message: t('payments.methodAddedSuccess'),
        severity: 'success'
      });
      fetchPaymentMethods();
    } catch (err) {
      setSnackbar({
        open: true,
        message: t('payments.methodAddedError'),
        severity: 'error'
      });
    }
  }, [addPaymentMethod, fetchPaymentMethods, t]);

  // Handle payment method deletion
  const handleMethodDelete = useCallback(async (methodId: string) => {
    try {
      await removePaymentMethod(methodId);
      if (selectedMethod?.id === methodId) {
        setSelectedMethod(null);
        onPaymentMethodChange?.(null);
      }
      setSnackbar({
        open: true,
        message: t('payments.methodDeletedSuccess'),
        severity: 'success'
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: t('payments.methodDeletedError'),
        severity: 'error'
      });
    }
  }, [removePaymentMethod, selectedMethod, onPaymentMethodChange, t]);

  // Handle form cancellation
  const handleFormCancel = useCallback(() => {
    setShowForm(false);
  }, []);

  // Handle snackbar close
  const handleSnackbarClose = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  if (loading) {
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
          aria-label={t('payments.loading')}
          role="progressbar"
        />
      </Container>
    );
  }

  return (
    <Container component="main" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              borderRadius: theme => theme.shape.culturalBorderRadius
            }}
            role="region"
            aria-label={t('payments.paymentMethods')}
          >
            {!showForm ? (
              <>
                <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <Grid item>
                    <Payment color="primary" />
                  </Grid>
                  <Grid item xs>
                    <h1>{t('payments.paymentMethods')}</h1>
                  </Grid>
                  <Grid item>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<Add />}
                      onClick={() => setShowForm(true)}
                      aria-label={t('payments.addNewMethod')}
                    >
                      {t('payments.addNewMethod')}
                    </Button>
                  </Grid>
                </Grid>

                <PaymentMethodList
                  onSelect={handleMethodSelect}
                  selectedId={selectedMethod?.id}
                  onDelete={handleMethodDelete}
                  showGatewayInfo
                />
              </>
            ) : (
              <>
                <h2>{t('payments.addNewMethod')}</h2>
                <PaymentMethodForm
                  onPaymentMethodAdded={handlePaymentMethodAdded}
                  onError={(error) => {
                    setSnackbar({
                      open: true,
                      message: error.message,
                      severity: 'error'
                    });
                  }}
                  onCancel={handleFormCancel}
                  currency="USD"
                  defaultGateway={PaymentGateway.STRIPE}
                  securityLevel="LEVEL_1"
                />
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PaymentMethodsPage;