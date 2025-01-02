# Contributing to the International Jewish Association Donation Platform

## Table of Contents
- [Introduction](#introduction)
- [Development Environment Setup](#development-environment-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Git Workflow](#git-workflow)
- [Testing Requirements](#testing-requirements)
- [Documentation Standards](#documentation-standards)
- [CI/CD Pipeline](#cicd-pipeline)
- [Security Guidelines](#security-guidelines)
- [Issue & PR Guidelines](#issue--pr-guidelines)
- [Code Review Process](#code-review-process)

## Introduction

Welcome to the International Jewish Association Donation Platform project. This document provides comprehensive guidelines for contributing to our platform across web, mobile, and backend components.

### Technology Stack
- Backend: Node.js 18 LTS
- Web Frontend: TypeScript 5.0+, React 18.2+
- iOS: Swift 5.9+
- Android: Kotlin 1.9+
- Database: MongoDB Atlas
- Cache: Redis Enterprise

## Development Environment Setup

### Prerequisites
1. Install VS Code (our standard IDE)
2. Install Docker Desktop
3. Node.js 18 LTS
4. Git

### Local Environment Setup
```bash
# Clone the repository
git clone https://github.com/your-org/donation-platform.git

# Install dependencies
npm install

# Start local development environment
docker-compose up -d
```

### Component-Specific Setup
- Web: `cd web && npm install`
- Backend: `cd backend && npm install`
- iOS: Open `ios/DonationPlatform.xcworkspace`
- Android: Open `android/` in Android Studio

## Code Style Guidelines

### General Standards
- Use ESLint and Prettier with provided configurations
- Maximum line length: 100 characters
- Use meaningful variable/function names
- Include JSDoc comments for public APIs

### Language-Specific Guidelines

#### TypeScript/JavaScript
```typescript
// Use explicit types
interface DonationData {
  amount: number;
  currency: string;
  donorId: string;
}

// Use async/await
async function processDonation(data: DonationData): Promise<void> {
  try {
    await validateDonation(data);
    // Implementation
  } catch (error) {
    // Error handling
  }
}
```

#### Swift
```swift
// Use Swift's naming conventions
struct DonationViewModel {
    private let donationService: DonationServicing
    
    func processDonation(_ amount: Decimal) async throws {
        // Implementation
    }
}
```

#### Kotlin
```kotlin
// Use Kotlin idioms
data class DonationData(
    val amount: BigDecimal,
    val currency: String,
    val donorId: String
)
```

### Cultural Sensitivity
- Support RTL languages (Hebrew)
- Use culturally appropriate terminology
- Follow Jewish calendar conventions where applicable

## Git Workflow

### Branch Naming
- Feature: `feature/JIRA-123-feature-description`
- Bug Fix: `bugfix/JIRA-123-bug-description`
- Hotfix: `hotfix/JIRA-123-issue-description`

### Commit Messages
```
type(scope): description

[optional body]

[optional footer]
```

Types: feat, fix, docs, style, refactor, test, chore

### Pull Request Process
1. Create branch from `develop`
2. Implement changes
3. Ensure tests pass
4. Update documentation
5. Submit PR with required template
6. Obtain two approvals

## Testing Requirements

### Coverage Requirements
- Minimum 80% code coverage
- Unit tests required for all business logic
- Integration tests for API endpoints
- E2E tests for critical user flows

### Testing Frameworks
- Backend: Jest
- Frontend: Jest + React Testing Library
- E2E: Cypress
- Mobile: XCTest (iOS), JUnit (Android)

### Security Testing
- SAST scanning in CI pipeline
- Dependency vulnerability scanning
- Regular penetration testing

## Documentation Standards

### API Documentation
- Use OpenAPI 3.0 specification
- Document all endpoints, parameters, and responses
- Include authentication requirements
- Provide example requests/responses

### Code Documentation
- Use JSDoc for JavaScript/TypeScript
- Document public interfaces
- Include usage examples
- Document security considerations

### Technical Documentation
- Keep README.md up to date
- Document architecture decisions
- Maintain deployment guides
- Update configuration documentation

## CI/CD Pipeline

### GitHub Actions Workflows
- `web.yml`: Web application pipeline
- `backend.yml`: Backend services pipeline
- `ios.yml`: iOS application pipeline
- `android.yml`: Android application pipeline

### Quality Gates
- Test coverage > 80%
- Code complexity < 15
- Duplication < 3%
- No critical security findings
- All tests passing

## Security Guidelines

### Authentication & Authorization
- Implement JWT with appropriate expiry
- Use refresh tokens
- Implement rate limiting
- Follow OAuth 2.0 standards

### Data Protection
- Encrypt sensitive data at rest
- Use TLS 1.3 for data in transit
- Implement field-level encryption
- Follow PCI DSS requirements

### Compliance Requirements
- GDPR compliance
- PCI DSS Level 1
- SOC 2 compliance
- Israeli privacy laws

## Issue & PR Guidelines

### Bug Reports
Use the bug report template and include:
- Expected behavior
- Actual behavior
- Reproduction steps
- Environment details

### Feature Requests
Use the feature request template and include:
- Business justification
- Acceptance criteria
- Technical considerations
- Security implications

### Pull Requests
Use the PR template and include:
- JIRA ticket reference
- Changes description
- Testing details
- Documentation updates

## Code Review Process

### Review Requirements
- Two approvals required
- Security review for sensitive changes
- Performance review for critical paths
- Accessibility review for UI changes

### Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests are comprehensive
- [ ] Documentation is updated
- [ ] Security considerations addressed
- [ ] Performance impact assessed
- [ ] Accessibility requirements met

### Time Zone Considerations
- Allow 24 hours for reviews
- Critical fixes can be expedited
- Consider global team distribution

For additional assistance, contact the development team leads or review our internal documentation.