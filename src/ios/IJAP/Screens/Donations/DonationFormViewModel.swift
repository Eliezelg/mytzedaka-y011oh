// Foundation v13.0+
import Foundation
// Combine v13.0+
import Combine

/// ViewModel managing donation form business logic with comprehensive validation,
/// security measures, and multi-gateway payment processing support
@available(iOS 13.0, *)
public final class DonationFormViewModel: ViewModelType {
    
    // MARK: - Input/Output Types
    
    public struct Input {
        let amountSubject: CurrentValueSubject<Decimal?, Never>
        let currencySubject: CurrentValueSubject<String, Never>
        let paymentMethodSubject: CurrentValueSubject<PaymentMethodType?, Never>
        let isAnonymousSubject: CurrentValueSubject<Bool, Never>
        let isRecurringSubject: CurrentValueSubject<Bool, Never>
        let recurringFrequencySubject: CurrentValueSubject<RecurringSchedule?, Never>
        let dedicationSubject: CurrentValueSubject<String?, Never>
        let submitTrigger: PassthroughSubject<Void, Never>
        let cancelTrigger: PassthroughSubject<Void, Never>
    }
    
    public struct Output {
        let isValid: AnyPublisher<Bool, Never>
        let isLoading: AnyPublisher<Bool, Never>
        let validationErrors: AnyPublisher<[ValidationError], Never>
        let processingStatus: AnyPublisher<PaymentStatus, Never>
        let donationResult: AnyPublisher<Result<Donation, Error>, Never>
        let securityStatus: AnyPublisher<ValidationStatus, Never>
    }
    
    // MARK: - Private Properties
    
    private let donationService: DonationService
    private let associationId: String
    private let campaignId: String?
    private var cancellables = Set<AnyCancellable>()
    
    private let loadingSubject = CurrentValueSubject<Bool, Never>(false)
    private let validationErrorsSubject = CurrentValueSubject<[ValidationError], Never>([])
    private let processingStatusSubject = CurrentValueSubject<PaymentStatus, Never>(.pending)
    private let donationResultSubject = PassthroughSubject<Result<Donation, Error>, Never>()
    private let securityStatusSubject = CurrentValueSubject<ValidationStatus, Never>(.initial)
    
    // MARK: - Initialization
    
    /// Initializes the donation form view model
    /// - Parameters:
    ///   - donationService: Service for processing donations
    ///   - associationId: ID of the recipient association
    ///   - campaignId: Optional campaign ID for targeted donations
    public init(
        donationService: DonationService,
        associationId: String,
        campaignId: String? = nil
    ) {
        self.donationService = donationService
        self.associationId = associationId
        self.campaignId = campaignId
    }
    
    // MARK: - ViewModelType Implementation
    
    public func transform(input: Input) -> Output {
        // Cancel existing subscriptions
        cancellables.removeAll()
        
        // Combine all form inputs for validation
        let formValidation = Publishers.CombineLatest4(
            input.amountSubject,
            input.currencySubject,
            input.paymentMethodSubject,
            input.recurringFrequencySubject
        )
        .map { [weak self] amount, currency, paymentMethod, frequency -> Bool in
            guard let self = self else { return false }
            return self.validateForm(
                amount: amount,
                currency: currency,
                paymentMethod: paymentMethod,
                frequency: frequency
            ).isValid
        }
        .eraseToAnyPublisher()
        
        // Handle form submission
        input.submitTrigger
            .filter { [weak self] _ in
                self?.loadingSubject.value == false
            }
            .sink { [weak self] _ in
                self?.processSubmission(input: input)
            }
            .store(in: &cancellables)
        
        // Handle cancellation
        input.cancelTrigger
            .sink { [weak self] _ in
                self?.handleCancellation()
            }
            .store(in: &cancellables)
        
        // Monitor security status
        setupSecurityMonitoring(input: input)
        
        return Output(
            isValid: formValidation,
            isLoading: loadingSubject.eraseToAnyPublisher(),
            validationErrors: validationErrorsSubject.eraseToAnyPublisher(),
            processingStatus: processingStatusSubject.eraseToAnyPublisher(),
            donationResult: donationResultSubject.eraseToAnyPublisher(),
            securityStatus: securityStatusSubject.eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func validateForm(
        amount: Decimal?,
        currency: String,
        paymentMethod: PaymentMethodType?,
        frequency: RecurringSchedule?
    ) -> (isValid: Bool, errors: [ValidationError]) {
        var errors: [ValidationError] = []
        
        // Validate amount
        if let amount = amount {
            let amountValidation = CurrencyUtils.validateAmount(amount, currencyCode: currency)
            if amountValidation != .valid {
                errors.append(.invalidAmount)
            }
        } else {
            errors.append(.invalidAmount)
        }
        
        // Validate currency
        if !CurrencyConfig.supportedCurrencies.contains(where: { $0.rawValue == currency }) {
            errors.append(.unsupportedCurrency)
        }
        
        // Validate payment method
        if paymentMethod == nil {
            errors.append(.invalidPaymentMethod)
        }
        
        // Validate recurring setup
        if frequency != nil && paymentMethod == .bankTransfer {
            errors.append(.invalidPaymentMethod)
        }
        
        validationErrorsSubject.send(errors)
        return (errors.isEmpty, errors)
    }
    
    private func processSubmission(input: Input) {
        loadingSubject.send(true)
        processingStatusSubject.send(.processing)
        
        guard let amount = input.amountSubject.value,
              let paymentMethod = input.paymentMethodSubject.value else {
            handleValidationFailure()
            return
        }
        
        donationService.createDonation(
            amount: amount,
            currency: input.currencySubject.value,
            associationId: associationId,
            paymentMethod: PaymentMethod(
                id: UUID().uuidString,
                type: paymentMethod,
                gatewayType: selectGatewayType(currency: input.currencySubject.value)
            ),
            isAnonymous: input.isAnonymousSubject.value,
            isRecurring: input.isRecurringSubject.value,
            campaignId: campaignId
        )
        .receive(on: DispatchQueue.main)
        .sink(
            receiveCompletion: { [weak self] completion in
                self?.loadingSubject.send(false)
                if case .failure(let error) = completion {
                    self?.donationResultSubject.send(.failure(error))
                }
            },
            receiveValue: { [weak self] donation in
                self?.processingStatusSubject.send(.completed)
                self?.donationResultSubject.send(.success(donation))
            }
        )
        .store(in: &cancellables)
    }
    
    private func handleValidationFailure() {
        loadingSubject.send(false)
        processingStatusSubject.send(.failed)
        securityStatusSubject.send(.invalid)
    }
    
    private func handleCancellation() {
        loadingSubject.send(false)
        processingStatusSubject.send(.pending)
        cancellables.removeAll()
    }
    
    private func setupSecurityMonitoring(input: Input) {
        // Monitor for suspicious activity
        Publishers.CombineLatest(
            input.amountSubject,
            input.currencySubject
        )
        .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
        .sink { [weak self] amount, currency in
            self?.validateSecurityThresholds(amount: amount, currency: currency)
        }
        .store(in: &cancellables)
    }
    
    private func validateSecurityThresholds(amount: Decimal?, currency: String) {
        guard let amount = amount else { return }
        
        let maxAmount = CurrencyConfig.minimumDonations[CurrencyConfig.Currency(rawValue: currency) ?? .usd] ?? 0
        if amount > maxAmount * 100 {
            securityStatusSubject.send(.compliance)
        } else {
            securityStatusSubject.send(.validated)
        }
    }
    
    private func selectGatewayType(currency: String) -> GatewayType {
        return currency.uppercased() == "ILS" ? .tranzilla : .stripe
    }
}