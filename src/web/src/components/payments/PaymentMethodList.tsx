import React, { useState, useCallback } from 'react'; // @version 18.2.0
import { 
  List, 
  ListItem, 
  ListItemText, 
  IconButton, 
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography
} from '@mui/material'; // @version 5.14.0
import { DeleteOutline } from '@mui/icons-material'; // @version 5.14.0
import { useTranslation } from 'react-i18next'; // @version 12.0.0

import { PaymentMethod } from '../../interfaces/payment.interface';
import { usePayments } from '../../hooks/usePayments';
import EmptyState from '../common/EmptyState';

interface PaymentMethodListProps {
  onSelect?: (method: PaymentMethod) => void;
  selectedId?: string;
  defaultId?: string;
  showGatewayInfo?: boolean;
}

/**
 * Formats payment method details for display
 */
const formatPaymentMethod = (method: PaymentMethod, showGatewayInfo: boolean): string => {
  const expiryDate = `${String(method.expiryMonth).padStart(2, '0')}/${method.expiryYear}`;
  let formattedText = `•••• ${method.lastFourDigits} | ${expiryDate}`;
  
  if (showGatewayInfo) {
    formattedText += ` | ${method.gateway}`;
  }
  
  if (method.currency) {
    formattedText += ` | ${method.currency}`;
  }
  
  return formattedText;
};

/**
 * A component that displays a list of saved payment methods with support for
 * both Stripe Connect and Tranzilla payment gateways
 */
const PaymentMethodList: React.FC<PaymentMethodListProps> = ({
  onSelect,
  selectedId,
  defaultId,
  showGatewayInfo = false
}) => {
  const { t } = useTranslation();
  const { paymentMethods, loading, removePaymentMethod, error } = usePayments();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(null);

  // Sort payment methods with default first
  const sortedPaymentMethods = React.useMemo(() => {
    return [...paymentMethods].sort((a, b) => {
      if (a.id === defaultId) return -1;
      if (b.id === defaultId) return 1;
      return 0;
    });
  }, [paymentMethods, defaultId]);

  const handleSelect = useCallback((method: PaymentMethod) => {
    onSelect?.(method);
  }, [onSelect]);

  const handleDeleteClick = useCallback((method: PaymentMethod, event: React.MouseEvent) => {
    event.stopPropagation();
    setMethodToDelete(method);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (methodToDelete) {
      await removePaymentMethod(methodToDelete.id);
      setDeleteDialogOpen(false);
      setMethodToDelete(null);
    }
  }, [methodToDelete, removePaymentMethod]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
    setMethodToDelete(null);
  }, []);

  if (loading) {
    return (
      <div role="status" aria-label={t('payments.loading')}>
        <CircularProgress />
      </div>
    );
  }

  if (!paymentMethods.length) {
    return (
      <EmptyState
        message={t('payments.noPaymentMethods')}
        action={
          <Button
            variant="contained"
            color="primary"
            onClick={() => onSelect?.(null)}
            aria-label={t('payments.addPaymentMethod')}
          >
            {t('payments.addPaymentMethod')}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <List
        role="listbox"
        aria-label={t('payments.savedPaymentMethods')}
        sx={{
          width: '100%',
          bgcolor: 'background.paper',
          borderRadius: theme => theme.shape.culturalBorderRadius,
        }}
      >
        {sortedPaymentMethods.map((method) => (
          <ListItem
            key={method.id}
            role="option"
            aria-selected={method.id === selectedId}
            button
            onClick={() => handleSelect(method)}
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-child': {
                borderBottom: 'none',
              },
              bgcolor: method.id === selectedId ? 'action.selected' : 'inherit',
            }}
          >
            <ListItemText
              primary={formatPaymentMethod(method, showGatewayInfo)}
              secondary={method.id === defaultId ? t('payments.defaultMethod') : null}
              sx={{
                '& .MuiTypography-root': {
                  fontFamily: theme => 
                    method.gateway === 'TRANZILLA' ? 
                    theme.typography.hebrewFontFamily : 
                    theme.typography.fontFamily,
                },
              }}
            />
            <IconButton
              onClick={(e) => handleDeleteClick(method, e)}
              aria-label={t('payments.deleteMethod')}
              size="small"
              edge="end"
            >
              <DeleteOutline />
            </IconButton>
          </ListItem>
        ))}
      </List>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          {t('payments.deleteMethodTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t('payments.deleteMethodConfirmation')}
          </Typography>
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error.message}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PaymentMethodList;