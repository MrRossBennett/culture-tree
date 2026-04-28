# Use app-owned entitlements for product access

Culture Tree will use billing state to determine which Plan a person has, but product code will enforce access through app-owned entitlements and allowances. This keeps Stripe and Better Auth responsible for payment and subscription lifecycle, while Culture Tree owns product concepts such as Free, Pro, Patron, AI Generation Allowance, Public Tree Browsing, and future manual support overrides.

## Considered Options

- Check Stripe or Better Auth subscription state directly wherever paid features are gated
- Define app-owned Plan Configuration and route all product gates through an entitlement helper

## Consequences

Feature gates should ask Culture Tree's entitlement layer what a person can do, rather than scattering billing-provider checks through server functions and UI code.
