# International Jewish Association Donation Platform - Web Application

## Overview

Enterprise-grade React application for facilitating charitable donations to Jewish associations worldwide. Built with React 18.2+, TypeScript 5.0+, and Material-UI 5.14+, featuring comprehensive RTL support and multi-language capabilities.

## Features

- 🌐 Multi-language support (Hebrew, English, French)
- 🔄 Seamless RTL/LTR switching
- 💳 Secure payment processing (Stripe Connect v2023-10, Tranzilla v1.0)
- ♿ WCAG 2.1 Level AA compliance
- 📱 Responsive design with Material-UI
- 🔒 Enterprise-grade security measures
- ⚡ Optimized performance metrics

## Prerequisites

- Node.js 18 LTS or higher
- npm 8+ or yarn 1.22+
- Git 2.30+
- VSCode with recommended extensions:
  - ESLint
  - Prettier
  - vscode-styled-components
  - Hebrew Support

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Development Setup

### Environment Configuration

Create a `.env` file in the project root:

```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_...
REACT_APP_TRANZILLA_TERMINAL_ID=...
```

### Available Scripts

- `npm start` - Starts development server with hot reload
- `npm run build` - Creates optimized production build
- `npm test` - Runs test suite with coverage
- `npm run lint` - Runs ESLint checks
- `npm run i18n:extract` - Extracts translation strings

## Architecture

### Core Dependencies

- **React** (v18.2+) - UI framework
- **TypeScript** (v5.0+) - Type safety
- **Material-UI** (v5.14+) - Component library
- **Redux Toolkit** (v1.9+) - State management
- **React Router** (v6.14+) - Routing
- **i18next** (v23.2+) - Internationalization
- **Stripe.js** (v1.54+) - Payment processing
- **Tranzilla SDK** (v1.0+) - Israeli payment processing

### Project Structure

```
src/
├── assets/          # Static assets
├── components/      # Reusable components
├── config/          # Configuration files
├── hooks/          # Custom React hooks
├── i18n/           # Translation files
├── layouts/        # Page layouts
├── pages/          # Route components
├── services/       # API services
├── store/          # Redux store
├── styles/         # Global styles
├── types/          # TypeScript definitions
└── utils/          # Utility functions
```

## Cultural Considerations

### RTL Support

- Automatic direction detection based on language
- RTL-aware component layouts
- Bidirectional text support
- Cultural-specific date formatting

### Hebrew Text Guidelines

- Use native Hebrew fonts
- Implement proper Hebrew text rendering
- Support for Hebrew numerals
- Jewish calendar integration

## Performance Requirements

- First Contentful Paint < 1.5s
- Time to Interactive < 3.5s
- Lighthouse score > 90
- Initial bundle size < 250KB
- RTL switch time < 100ms

## Browser Support

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90
- iOS Safari >= 14
- Android Chrome >= 90

## Testing

### Unit Testing

```bash
# Run unit tests
npm test

# Generate coverage report
npm test -- --coverage
```

### E2E Testing

```bash
# Run Cypress tests
npm run cypress:open
```

## Deployment

### Production Build

```bash
# Create production build
npm run build

# Analyze bundle size
npm run analyze
```

### Performance Optimization

- Route-based code splitting
- Image optimization
- Lazy loading components
- Service Worker caching
- CDN integration

## Contributing

1. Follow TypeScript strict mode
2. Ensure 80%+ test coverage
3. Maintain accessibility compliance
4. Document all new features
5. Follow Git commit conventions

## Security

- Implement Content Security Policy
- Regular dependency audits
- XSS prevention measures
- CSRF protection
- Secure payment handling

## License

Proprietary - All rights reserved

## Support

For technical support, please contact:
- Email: support@platform.org
- Documentation: [Internal Wiki]
- Issue Tracker: [JIRA]