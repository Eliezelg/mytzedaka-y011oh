import * as yup from 'yup'; // v1.3.2
import { ICampaign, ICampaignLotteryDetails } from '../interfaces/campaign.interface';
import { CURRENCY_REGEX } from '../../../backend/src/constants/regex.constant';

// Constants for campaign validation
const MIN_CAMPAIGN_DURATION_DAYS = 1;
const MAX_CAMPAIGN_DURATION_DAYS = 365;
const MIN_GOAL_AMOUNTS = {
  USD: 100,
  EUR: 100,
  ILS: 500
};
const MAX_GOAL_AMOUNTS = {
  USD: 10000000,
  EUR: 10000000,
  ILS: 50000000
};
const MIN_TICKET_PRICE = {
  USD: 5,
  EUR: 5,
  ILS: 18
};
const MAX_TICKETS = 10000;
const RESTRICTED_WORDS = ['spam', 'scam', 'fake'];
const PRIZE_VALUE_RATIO = 0.5;

/**
 * Validation schema for lottery campaign details
 * Includes comprehensive prize structure validation and draw date verification
 */
export const lotteryDetailsSchema = yup.object().shape({
  drawDate: yup.date()
    .required('Draw date is required')
    .min(new Date(), 'Draw date must be in the future')
    .test('within-campaign', 'Draw date must be within campaign period', 
      function(value) {
        const { parent } = this;
        return !value || !parent.endDate || value <= parent.endDate;
      }),

  ticketPrice: yup.number()
    .required('Ticket price is required')
    .test('valid-ticket-price', 'Invalid ticket price for currency', 
      function(value) {
        const { parent } = this;
        return !value || 
          value >= (MIN_TICKET_PRICE[parent.currency as keyof typeof MIN_TICKET_PRICE] || 5);
      }),

  currency: yup.string()
    .required('Currency is required')
    .matches(CURRENCY_REGEX, 'Invalid currency format')
    .oneOf(['USD', 'EUR', 'ILS'], 'Unsupported currency'),

  maxTickets: yup.number()
    .required('Maximum tickets is required')
    .min(1, 'Must have at least 1 ticket')
    .max(MAX_TICKETS, `Cannot exceed ${MAX_TICKETS} tickets`),

  prizes: yup.array().of(
    yup.object().shape({
      description: yup.string()
        .required('Prize description is required')
        .min(10, 'Description too short')
        .max(500, 'Description too long'),
      value: yup.number()
        .required('Prize value is required')
        .min(0, 'Prize value cannot be negative')
        .test('total-prize-value', 'Total prize value exceeds allowed ratio', 
          function(value) {
            const { parent, from } = this;
            const campaign = from[from.length - 1].value;
            const totalPrizeValue = campaign.lotteryDetails.prizes
              .reduce((sum: number, prize: { value: number }) => sum + prize.value, 0);
            return totalPrizeValue <= (campaign.goalAmount * PRIZE_VALUE_RATIO);
          }),
      imageUrl: yup.string()
        .nullable()
        .url('Invalid image URL')
    })
  )
    .required('Prizes are required')
    .min(1, 'At least one prize is required'),

  termsAndConditions: yup.string()
    .required('Terms and conditions are required')
    .min(100, 'Terms and conditions too short')
    .max(5000, 'Terms and conditions too long'),

  winnerSelectionMethod: yup.string()
    .required('Winner selection method is required')
    .oneOf(['random', 'sequential'], 'Invalid winner selection method')
});

/**
 * Main campaign validation schema
 * Supports both regular and lottery-based campaigns with enhanced validation rules
 */
export const campaignSchema = yup.object().shape({
  title: yup.string()
    .required('Title is required')
    .min(3, 'Title too short')
    .max(100, 'Title too long')
    .test('no-restricted-words', 'Title contains restricted words', 
      value => !value || !RESTRICTED_WORDS.some(word => 
        value.toLowerCase().includes(word)
      )),

  description: yup.string()
    .required('Description is required')
    .min(50, 'Description too short')
    .max(5000, 'Description too long')
    .test('html-safety', 'Invalid HTML content', 
      value => !value || !/(<script|javascript:|onclick|onerror)/i.test(value)),

  goalAmount: yup.number()
    .required('Goal amount is required')
    .test('valid-goal-amount', 'Invalid goal amount for currency', 
      function(value) {
        const { currency } = this.parent;
        return !value || (
          value >= (MIN_GOAL_AMOUNTS[currency as keyof typeof MIN_GOAL_AMOUNTS] || 100) &&
          value <= (MAX_GOAL_AMOUNTS[currency as keyof typeof MAX_GOAL_AMOUNTS] || 10000000)
        );
      }),

  currency: yup.string()
    .required('Currency is required')
    .matches(CURRENCY_REGEX, 'Invalid currency format')
    .oneOf(['USD', 'EUR', 'ILS'], 'Unsupported currency'),

  visibility: yup.string()
    .required('Visibility is required')
    .oneOf(['public', 'private', 'unlisted'], 'Invalid visibility option'),

  categories: yup.array()
    .of(yup.string())
    .min(1, 'At least one category required')
    .max(5, 'Maximum 5 categories allowed'),

  images: yup.array()
    .of(yup.object().shape({
      url: yup.string().required('Image URL required').url('Invalid image URL'),
      altText: yup.string().required('Alt text required'),
      ariaLabel: yup.string().required('Aria label required')
    }))
    .min(1, 'At least one image required'),

  startDate: yup.date()
    .required('Start date is required')
    .min(new Date(), 'Start date must be in the future'),

  endDate: yup.date()
    .required('End date is required')
    .test('valid-duration', 'Invalid campaign duration', 
      function(value) {
        const { startDate } = this.parent;
        if (!value || !startDate) return true;
        const duration = Math.ceil((value.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        return duration >= MIN_CAMPAIGN_DURATION_DAYS && duration <= MAX_CAMPAIGN_DURATION_DAYS;
      }),

  minimumDonationAmount: yup.number()
    .required('Minimum donation amount is required')
    .min(1, 'Minimum donation must be at least 1'),

  isLottery: yup.boolean()
    .required('Lottery status is required'),

  lotteryDetails: yup.mixed()
    .when('isLottery', {
      is: true,
      then: () => lotteryDetailsSchema.required('Lottery details required for lottery campaigns'),
      otherwise: () => yup.mixed().nullable()
    }),

  socialShareText: yup.string()
    .required('Social share text is required')
    .max(280, 'Social share text too long'),

  associationId: yup.string()
    .required('Association ID is required')
    .matches(/^[a-f\d]{24}$/i, 'Invalid association ID format')
});