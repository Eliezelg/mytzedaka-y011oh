/**
 * Enum defining possible campaign status values
 */
export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

/**
 * Interface defining lottery-specific campaign details including ticket tracking
 * and winner selection mechanisms
 */
export interface ICampaignLotteryDetails {
  /** Date when lottery winners will be drawn */
  drawDate: Date;
  
  /** Price per lottery ticket */
  ticketPrice: number;
  
  /** ISO 4217 currency code for ticket prices */
  currency: string;
  
  /** Maximum number of tickets available */
  maxTickets: number;
  
  /** Current number of tickets sold */
  ticketsSold: number;
  
  /** Number of tickets still available for purchase */
  remainingTickets: number;
  
  /** Method used for selecting winners (e.g., 'random', 'sequential') */
  winnerSelectionMethod: string;
  
  /** Legal terms and conditions for lottery participation */
  termsAndConditions: string;
  
  /** List of prizes with descriptions, values, and optional images */
  prizes: Array<{
    description: string;
    value: number;
    imageUrl?: string;
  }>;
}

/**
 * Main interface for campaign data with enhanced social and visibility features.
 * Supports regular and lottery-based campaigns with multi-currency functionality.
 */
export interface ICampaign {
  /** Unique identifier for the campaign */
  id: string;
  
  /** Campaign title with support for RTL languages */
  title: string;
  
  /** Detailed campaign description with HTML support */
  description: string;
  
  /** Target amount to raise */
  goalAmount: number;
  
  /** Minimum allowed donation amount */
  minimumDonationAmount: number;
  
  /** ISO 4217 campaign currency code */
  currency: string;
  
  /** Campaign visibility setting (public/private/unlisted) */
  visibility: string;
  
  /** Unique shareable campaign URL */
  shareableUrl: string;
  
  /** Predefined text for social media sharing */
  socialShareText: string;
  
  /** Campaign categorization tags */
  categories: string[];
  
  /** Campaign images with accessibility support */
  images: Array<{
    url: string;
    altText: string;
    ariaLabel: string;
  }>;
  
  /** Campaign start date */
  startDate: Date;
  
  /** Campaign end date */
  endDate: Date;
  
  /** ID of the association running the campaign */
  associationId: string;
  
  /** Current amount raised */
  currentAmount: number;
  
  /** Number of unique donors */
  donorCount: number;
  
  /** Flag indicating if campaign includes lottery */
  isLottery: boolean;
  
  /** Lottery-specific details if applicable */
  lotteryDetails: ICampaignLotteryDetails | null;
  
  /** Campaign status (draft/active/paused/completed/cancelled) */
  status: CampaignStatus;
}

/**
 * Interface for comprehensive campaign progress tracking
 * Provides detailed metrics for monitoring campaign success
 */
export interface ICampaignProgress {
  /** Current amount raised */
  currentAmount: number;
  
  /** Target amount to raise */
  goalAmount: number;
  
  /** Progress percentage (0-100) */
  percentage: number;
  
  /** Optional target number of donors */
  donorsTarget: number | null;
  
  /** Percentage of donor target reached */
  donorsPercentage: number;
  
  /** Number of days remaining in campaign */
  timeRemainingDays: number;
}