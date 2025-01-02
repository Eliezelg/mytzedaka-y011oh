import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  Snackbar,
  Tooltip,
} from '@mui/material';
import {
  DownloadRounded as DownloadIcon,
  ContentCopy as CopyIcon,
  Print as PrintIcon,
} from '@mui/icons-material';

import DonationSummary from '../components/donations/DonationSummary';
import { IDonation } from '../interfaces/donation.interface';
import { DonationService } from '../services/donation.service';
import useLanguage from '../hooks/useLanguage';

// Initialize donation service
const donationService = new DonationService();

const DonationConfirmationPage: React.FC = () => {
  // State management
  const [donation, setDonation] = useState<IDonation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Hooks
  const { id: donationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isRTL, currentLanguage } = useLanguage();
  const statusRef = useRef<HTMLDivElement>(null);

  // Load donation details with retry mechanism
  const loadDonationDetails = useCallback(async () => {
    if (!donationId) {
      setError('Invalid donation ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Announce loading state to screen readers
      if (statusRef.current) {
        statusRef.current.textContent = 'Loading donation details...';
      }

      const donationData = await donationService.getDonationById(donationId);
      setDonation(donationData);
      
      // Announce success to screen readers
      if (statusRef.current) {
        statusRef.current.textContent = 'Donation details loaded successfully';
      }
    } catch (err) {
      if (retryCount < 3) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => loadDonationDetails(), 1000 * (retryCount + 1));
      } else {
        setError('Failed to load donation details. Please try again later.');
        if (statusRef.current) {
          statusRef.current.textContent = 'Error loading donation details';
        }
      }
    } finally {
      setLoading(false);
    }
  }, [donationId, retryCount]);

  // Handle receipt download with progress tracking
  const handleDownloadReceipt = async () => {
    if (!donation) return;

    try {
      setReceiptLoading(true);
      setDownloadProgress(0);
      
      // Announce download start to screen readers
      if (statusRef.current) {
        statusRef.current.textContent = 'Generating donation receipt...';
      }

      await donationService.generateDonationReceipt(donation.id);
      setDownloadProgress(100);
      
      // Announce completion to screen readers
      if (statusRef.current) {
        statusRef.current.textContent = 'Receipt downloaded successfully';
      }
    } catch (err) {
      setError('Failed to download receipt. Please try again.');
      if (statusRef.current) {
        statusRef.current.textContent = 'Error downloading receipt';
      }
    } finally {
      setReceiptLoading(false);
    }
  };

  // Handle reference number copy with accessibility
  const handleCopyReference = async () => {
    if (!donation?.referenceNumber) return;

    try {
      await navigator.clipboard.writeText(donation.referenceNumber);
      setCopySuccess(true);
      
      // Announce copy success to screen readers
      if (statusRef.current) {
        statusRef.current.textContent = 'Reference number copied to clipboard';
      }
    } catch (err) {
      setError('Failed to copy reference number');
    }
  };

  // Initial load effect
  useEffect(() => {
    loadDonationDetails();
  }, [loadDonationDetails]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Hidden live region for screen reader announcements */}
      <div
        ref={statusRef}
        role="status"
        aria-live="polite"
        className="sr-only"
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          direction: isRTL ? 'rtl' : 'ltr',
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          align={isRTL ? 'right' : 'left'}
          gutterBottom
        >
          Donation Confirmation
        </Typography>

        {loading && (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress
              aria-label="Loading donation details"
              role="progressbar"
            />
          </Box>
        )}

        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        {donation && (
          <>
            <DonationSummary
              donation={donation}
              showStatus
              ariaLabel="Donation details summary"
            />

            <Box
              sx={{
                display: 'flex',
                gap: 2,
                flexWrap: 'wrap',
                justifyContent: isRTL ? 'flex-end' : 'flex-start',
              }}
            >
              <Tooltip title="Download receipt">
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadReceipt}
                  disabled={receiptLoading}
                  aria-busy={receiptLoading}
                >
                  {receiptLoading ? (
                    <CircularProgress
                      size={24}
                      value={downloadProgress}
                      aria-label="Download progress"
                    />
                  ) : (
                    'Download Receipt'
                  )}
                </Button>
              </Tooltip>

              <Tooltip title="Copy reference number">
                <Button
                  variant="outlined"
                  startIcon={<CopyIcon />}
                  onClick={handleCopyReference}
                  aria-label="Copy donation reference number"
                >
                  Copy Reference
                </Button>
              </Tooltip>

              <Tooltip title="Print confirmation">
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={() => window.print()}
                  aria-label="Print donation confirmation"
                >
                  Print
                </Button>
              </Tooltip>
            </Box>
          </>
        )}
      </Box>

      <Snackbar
        open={copySuccess}
        autoHideDuration={3000}
        onClose={() => setCopySuccess(false)}
        message="Reference number copied to clipboard"
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: isRTL ? 'left' : 'right',
        }}
      />
    </Container>
  );
};

export default DonationConfirmationPage;