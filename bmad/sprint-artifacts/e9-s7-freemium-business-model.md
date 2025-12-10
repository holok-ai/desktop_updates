# Story 9.7: Freemium Business Model

Status: ready-for-dev

## Story

As a workflow creator,
I want to monetize my premium workflows through the marketplace,
so that I can earn revenue while contributing valuable workflows to the community.

## Acceptance Criteria

1. **AC-7.1: Stripe Checkout Integration**
   - Premium workflows purchasable via Stripe Checkout
   - Payment flow opens in browser window for PCI compliance
   - Payment success triggers automatic workflow installation
   - Payment failures show clear error messages with retry option

2. **AC-7.2: Revenue Sharing**
   - 70% creator share, 30% Holokai platform share calculated correctly
   - Revenue split recorded in `creator_payouts` table
   - Creator share amounts visible in creator dashboard

3. **AC-7.3: Monthly Payouts**
   - Automated monthly payout job runs via Stripe Connect
   - Minimum payout threshold of $100 enforced
   - Payouts below threshold roll over to next month
   - Successful payouts update status to 'paid' with timestamp

4. **AC-7.4: Creator Dashboard**
   - Dashboard shows total revenue (all-time and current period)
   - Dashboard displays workflow-specific statistics (installs, revenue)
   - Dashboard shows reputation score and earned badges
   - Dashboard shows pending payout amount and next payout date

5. **AC-7.5: Grants System**
   - Top contributors receive monthly grants ($500-$5,000/year)
   - Grants calculated based on installs, ratings, and community engagement
   - Grant awards visible in creator dashboard
   - Reputation scores increase with grant achievements

6. **AC-7.6: Leaderboards and Badges**
   - 'Top Contributor' badge awarded to top 10 creators monthly
   - 'Rising Star' badge awarded to new creators with rapid growth
   - 'Verified Publisher' badge awarded after manual verification
   - Badges displayed on workflow detail pages and creator profiles

## Tasks / Subtasks

### Task 1: Backend - Stripe Integration (AC: 7.1, 7.2, 7.3)
- [ ] **1.1 Configure Stripe API Keys**
  - [ ] Add Stripe secret key to Moku API environment configuration
  - [ ] Add Stripe Connect client ID for creator onboarding
  - [ ] Configure Stripe webhook secret for payment verification
  - [ ] Test with Stripe test mode keys in development environment

- [ ] **1.2 Implement StripeService**
  - [ ] Create `StripeService.java` in Moku API services
  - [ ] Implement `createCheckoutSession(workflowId, userId)` for payment initiation
  - [ ] Implement `handlePaymentSuccessWebhook(paymentIntent)` for payment confirmation
  - [ ] Implement `createCreatorConnectAccount(userId, businessInfo)` for creator onboarding
  - [ ] Implement `calculateRevenueSplit(totalAmount)` with 70/30 split logic
  - [ ] Add error handling for Stripe API failures with retry logic

- [ ] **1.3 Create Marketplace Purchase Endpoint**
  - [ ] Add `POST /api/marketplace/workflows/{id}/purchase` in `MarketplaceController`
  - [ ] Validate workflow exists and is premium (pricingType = 'premium')
  - [ ] Check user not already owns workflow (query `workflow_installations`)
  - [ ] Create Stripe checkout session with workflow metadata
  - [ ] Return checkout URL for desktop app to open in browser
  - [ ] Add integration test for purchase flow

- [ ] **1.4 Implement Stripe Webhook Endpoint**
  - [ ] Add `POST /api/webhooks/stripe` endpoint (no auth, uses webhook secret)
  - [ ] Verify webhook signature using Stripe library
  - [ ] Handle `payment_intent.succeeded` event
  - [ ] Handle `payment_intent.failed` event
  - [ ] Create `workflow_installations` record on payment success
  - [ ] Create `creator_payouts` record with 70/30 split
  - [ ] Update `install_count` on marketplace workflow
  - [ ] Return 200 response for idempotency (Stripe retries webhooks)

- [ ] **1.5 Implement Monthly Payout Job**
  - [ ] Create `PayoutScheduler.java` with `@Scheduled` cron job
  - [ ] Run on 1st of each month at 00:00 UTC
  - [ ] Query `creator_payouts` table for 'pending' status in previous month
  - [ ] Group by `author_id` and sum `creator_share_usd`
  - [ ] Skip if total < $100 threshold (roll over to next month)
  - [ ] Create Stripe Connect payout for each creator
  - [ ] Update `creator_payouts` status to 'paid' with `stripe_payout_id`
  - [ ] Send email notification to creator with payout details
  - [ ] Log payout failures for manual review

### Task 2: Backend - Creator Dashboard API (AC: 7.4)
- [ ] **2.1 Create Creator Dashboard Endpoint**
  - [ ] Add `GET /api/marketplace/creators/dashboard` in `MarketplaceController`
  - [ ] Authenticate user via JWT token
  - [ ] Query `publisher_profiles` for creator stats (total_workflows, total_installs, total_revenue)
  - [ ] Query `creator_payouts` for pending payout amount (status = 'pending')
  - [ ] Calculate next payout date (1st of next month)
  - [ ] Return `CreatorDashboardDTO` with all stats

- [ ] **2.2 Create Workflow Stats Endpoint**
  - [ ] Add `GET /api/marketplace/creators/workflows` endpoint
  - [ ] Filter workflows by current user's `author_id`
  - [ ] Join with `workflow_installations` to get install counts per workflow
  - [ ] Join with `creator_payouts` to get revenue per workflow
  - [ ] Calculate average rating from `workflow_reviews`
  - [ ] Return list of `WorkflowStatsDTO` sorted by revenue descending

- [ ] **2.3 Create Payout History Endpoint**
  - [ ] Add `GET /api/marketplace/creators/payouts` with pagination
  - [ ] Filter `creator_payouts` by current user's `author_id`
  - [ ] Include period dates, amounts, status, and Stripe payout ID
  - [ ] Order by `period_end` descending (most recent first)
  - [ ] Support pagination (limit 20 per page)

### Task 3: Backend - Grants and Reputation System (AC: 7.5, 7.6)
- [ ] **3.1 Implement Reputation Calculation**
  - [ ] Create `ReputationService.java` with scoring algorithm
  - [ ] Calculate base score from total installs (1 point per 10 installs)
  - [ ] Add bonus from average rating (rating * 10 points)
  - [ ] Add bonus from verified publisher badge (+50 points)
  - [ ] Add bonus from grants received (grant amount / 100 points)
  - [ ] Update `publisher_profiles.reputation_score` for all creators

- [ ] **3.2 Implement Monthly Grant Calculation**
  - [ ] Create `GrantScheduler.java` with `@Scheduled` cron job
  - [ ] Run on 1st of each month after payout job
  - [ ] Query top 20 creators by reputation score
  - [ ] Assign grant tiers: Top 5 ($5000), Top 10 ($2000), Top 20 ($500)
  - [ ] Create `creator_payouts` entries with grant amounts (status = 'pending')
  - [ ] Award 'Top Contributor' badge to top 10
  - [ ] Send email notifications to grant recipients

- [ ] **3.3 Implement Badge Award Logic**
  - [ ] Create `BadgeService.java` with badge award methods
  - [ ] Implement `awardTopContributorBadge()` called by grant scheduler
  - [ ] Implement `awardRisingStarBadge()` for new creators (>100 installs in first 30 days)
  - [ ] Implement `awardVerifiedPublisherBadge()` (manual admin action)
  - [ ] Update `publisher_profiles.badges` array with new badges
  - [ ] Avoid duplicate badges (check before adding)

- [ ] **3.4 Create Badge Display Endpoint**
  - [ ] Add badge data to `GET /api/marketplace/workflows/{id}` response
  - [ ] Include author's badges in workflow detail response
  - [ ] Add badge icons/names to `PublisherProfileDTO`

### Task 4: Desktop - Payment Flow (AC: 7.1)
- [ ] **4.1 Create Purchase Flow in MarketplaceService**
  - [ ] Add `purchaseWorkflow(workflowId)` method to `MarketplaceService` (main process)
  - [ ] Call `POST /api/marketplace/workflows/{id}/purchase` via Moku API
  - [ ] Extract Stripe checkout URL from response
  - [ ] Open checkout URL in external browser using `shell.openExternal()`
  - [ ] Start polling for payment status (every 2 seconds for 5 minutes)
  - [ ] On payment success, trigger automatic installation
  - [ ] On timeout, show "Payment in progress" message with manual refresh option

- [ ] **4.2 Add IPC Handler for Purchase**
  - [ ] Add `ipcMain.handle('marketplace:purchase')` in main process
  - [ ] Delegate to `MarketplaceService.purchaseWorkflow()`
  - [ ] Return purchase status (success, pending, failed) to renderer
  - [ ] Handle errors with user-friendly messages

- [ ] **4.3 Update WorkflowDetailPage with Purchase Button**
  - [ ] Show "Purchase $X.XX" button for premium workflows (not owned)
  - [ ] Disable button during payment processing
  - [ ] Show loading spinner while opening checkout
  - [ ] Show success message after successful purchase
  - [ ] Show error message with retry button on failure

### Task 5: Desktop - Creator Dashboard UI (AC: 7.4, 7.6)
- [ ] **5.1 Create CreatorDashboard Component**
  - [ ] Create `CreatorDashboard.svelte` component
  - [ ] Add route `/creator-dashboard` in router
  - [ ] Fetch data from `GET /api/marketplace/creators/dashboard` on mount
  - [ ] Display total revenue with formatting ($X,XXX.XX)
  - [ ] Display pending payout amount and next payout date
  - [ ] Display reputation score with visual indicator (progress bar or badge)
  - [ ] Display earned badges with icons and tooltips

- [ ] **5.2 Create Workflow Stats Table**
  - [ ] Fetch data from `GET /api/marketplace/creators/workflows`
  - [ ] Display table with columns: Name, Installs, Revenue, Avg Rating
  - [ ] Sort by revenue (highest first) by default
  - [ ] Allow sorting by other columns (installs, rating)
  - [ ] Show "No workflows published" message if empty

- [ ] **5.3 Create Payout History Section**
  - [ ] Fetch data from `GET /api/marketplace/creators/payouts`
  - [ ] Display table with columns: Period, Amount, Status, Date Paid
  - [ ] Show status badges (Pending/Processing/Paid/Failed)
  - [ ] Support pagination (20 per page)
  - [ ] Show Stripe payout ID as tooltip on hover

- [ ] **5.4 Add Navigation to Dashboard**
  - [ ] Add "Creator Dashboard" link to user menu (if user has published workflows)
  - [ ] Add icon indicator (dollar sign or crown) for creator users
  - [ ] Hide menu item if user has not published any workflows

### Task 6: Testing and Documentation (All ACs)
- [ ] **6.1 Write Backend Integration Tests**
  - [ ] Test purchase flow with Stripe test mode (successful payment)
  - [ ] Test purchase flow with Stripe test mode (failed payment)
  - [ ] Test webhook idempotency (duplicate payment_intent events)
  - [ ] Test payout job with $99 balance (should not pay out, roll over)
  - [ ] Test payout job with $150 balance (should pay out)
  - [ ] Test grant calculation for top 20 creators
  - [ ] Test badge award logic (Top Contributor, Rising Star)

- [ ] **6.2 Write Desktop E2E Tests**
  - [ ] Test premium workflow purchase flow (Playwright + Stripe mock)
  - [ ] Test payment polling and automatic installation
  - [ ] Test creator dashboard data display
  - [ ] Test payout history pagination

- [ ] **6.3 Update API Documentation**
  - [ ] Document `/api/marketplace/workflows/{id}/purchase` endpoint
  - [ ] Document `/api/webhooks/stripe` webhook format
  - [ ] Document `/api/marketplace/creators/dashboard` response schema
  - [ ] Document revenue split calculation (70/30)
  - [ ] Document payout threshold ($100 minimum)

## Dev Notes

### Stripe Integration Architecture

**Payment Flow:**
1. User clicks "Purchase $9.99" on premium workflow → Desktop calls `marketplace:purchase` IPC
2. Main process → Moku API `POST /api/marketplace/workflows/{id}/purchase`
3. Moku API → Stripe: Create Checkout Session with workflow metadata
4. Desktop opens Stripe checkout URL in external browser
5. User completes payment on Stripe-hosted page
6. Stripe webhook → Moku API `POST /api/webhooks/stripe` with `payment_intent.succeeded`
7. Moku API creates `workflow_installations` and `creator_payouts` entries
8. Desktop polls for payment status → installs workflow automatically

**Security Considerations:**
- Never store credit card data in Holokai systems (Stripe Checkout handles all payment data)
- Verify webhook signatures using Stripe webhook secret
- Use Stripe test mode keys for development/testing
- Implement idempotency keys for webhook processing (Stripe retries failed webhooks)

### Revenue Split Calculation

```typescript
// 70/30 split favoring creators
function calculateRevenueSplit(totalSalesUsd: number) {
  const creatorShareUsd = totalSalesUsd * 0.70; // 70% to creator
  const holokaiShareUsd = totalSalesUsd * 0.30; // 30% to platform
  return { creatorShareUsd, holokaiShareUsd };
}
```

### Payout Threshold Logic

```java
// Monthly payout job
@Scheduled(cron = "0 0 0 1 * ?") // 1st of month at midnight UTC
public void processMonthlyPayouts() {
  List<CreatorPayout> pendingPayouts = creatorPayoutRepository
    .findByStatusAndPeriodEnd("pending", LocalDate.now().minusMonths(1));

  Map<UUID, BigDecimal> creatorTotals = pendingPayouts.stream()
    .collect(Collectors.groupingBy(
      CreatorPayout::getAuthorId,
      Collectors.reducing(BigDecimal.ZERO, CreatorPayout::getCreatorShareUsd, BigDecimal::add)
    ));

  creatorTotals.forEach((authorId, totalAmount) -> {
    if (totalAmount.compareTo(new BigDecimal("100.00")) >= 0) {
      // Process payout via Stripe Connect
      String payoutId = stripeService.createPayout(authorId, totalAmount);
      // Update records to 'paid' status
    } else {
      // Roll over to next month (status remains 'pending')
      logger.info("Creator {} balance ${} below $100 threshold, rolling over", authorId, totalAmount);
    }
  });
}
```

### Reputation Scoring Algorithm

```typescript
// Reputation score calculation (updated monthly)
function calculateReputationScore(creator: PublisherProfile): number {
  let score = 0;

  // Base: 1 point per 10 installs
  score += Math.floor(creator.totalInstalls / 10);

  // Bonus: Average rating * 10 (5.0 rating = +50 points)
  score += Math.floor(creator.averageRating * 10);

  // Bonus: Verified publisher badge
  if (creator.badges.includes('Verified Publisher')) {
    score += 50;
  }

  // Bonus: Grants (1 point per $100 in grants)
  const grantBonus = Math.floor(creator.totalGrantsUsd / 100);
  score += grantBonus;

  return score;
}
```

### Badge Award Criteria

| Badge | Criteria | Frequency |
|-------|----------|-----------|
| **Top Contributor** | Top 10 creators by reputation score | Monthly |
| **Rising Star** | New creators (< 90 days) with > 100 installs | Monthly |
| **Verified Publisher** | Manual verification by Holokai team (identity, security record) | On request |

### Database Schema References

**creator_payouts table:**
```sql
CREATE TABLE creator_payouts (
  id UUID PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES users(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_sales_usd DECIMAL(10,2) NOT NULL,
  creator_share_usd DECIMAL(10,2) NOT NULL, -- 70% of total_sales
  holokai_share_usd DECIMAL(10,2) NOT NULL, -- 30% of total_sales
  stripe_payout_id VARCHAR(255),
  status VARCHAR(50) CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**publisher_profiles table:**
```sql
CREATE TABLE publisher_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  display_name VARCHAR(100) NOT NULL,
  verified BOOLEAN DEFAULT false,
  reputation_score INT DEFAULT 0,
  total_workflows_published INT DEFAULT 0,
  total_installs INT DEFAULT 0,
  total_revenue_usd DECIMAL(10,2) DEFAULT 0.0,
  badges TEXT[] -- e.g., ['Top Contributor', 'Verified Publisher']
);
```

### API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/marketplace/workflows/{id}/purchase` | POST | Initiate premium workflow purchase |
| `/api/webhooks/stripe` | POST | Handle Stripe payment webhooks |
| `/api/marketplace/creators/dashboard` | GET | Get creator dashboard stats |
| `/api/marketplace/creators/workflows` | GET | Get creator's workflow statistics |
| `/api/marketplace/creators/payouts` | GET | Get creator's payout history |

### Error Handling

**Payment Failures:**
- Show clear error message: "Payment failed. Please try again or contact support."
- Provide retry button without re-creating checkout session (reuse existing)
- Log payment failure details for support team debugging

**Webhook Failures:**
- Return 200 to Stripe even on processing errors (to prevent infinite retries)
- Log error details and create manual review task
- Send alert to operations team for payouts > $100

**Payout Failures:**
- Stripe Connect account not connected → Email creator with onboarding link
- Insufficient funds in Holokai Stripe account → Alert finance team
- Payout below threshold → Roll over silently (no error)

### Project Structure Notes

**Backend (Moku API):**
```
src/main/java/com/holokai/moku/
├── controller/
│   ├── MarketplaceController.java (purchase endpoint)
│   └── WebhookController.java (Stripe webhooks)
├── service/
│   ├── StripeService.java (payment processing)
│   ├── ReputationService.java (scoring logic)
│   └── BadgeService.java (badge awards)
├── scheduler/
│   ├── PayoutScheduler.java (monthly payouts)
│   └── GrantScheduler.java (monthly grants)
└── dto/
    ├── CreatorDashboardDTO.java
    ├── WorkflowStatsDTO.java
    └── CreatorPayoutDTO.java
```

**Desktop (Electron):**
```
src/
├── main/
│   ├── services/
│   │   └── MarketplaceService.ts (purchase, polling)
│   └── ipc-handlers/
│       └── marketplace-handlers.ts (IPC for purchase)
└── renderer/
    └── lib/components/
        ├── CreatorDashboard.svelte
        ├── WorkflowStatsTable.svelte
        └── PayoutHistory.svelte
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-9.md §4.2 Data Models and Contracts]
- [Source: docs/sprint-artifacts/tech-spec-epic-9.md §4.3 APIs and Interfaces - Stripe Endpoints]
- [Source: docs/sprint-artifacts/tech-spec-epic-9.md §4.4 Workflows and Sequencing - Premium Purchase Flow]
- [Source: docs/sprint-artifacts/tech-spec-epic-9.md §5 Non-Functional Requirements - Security (Stripe PCI-DSS)]
- [Source: docs/architecture.md §2 Multi-Process Electron Architecture]
- [Source: docs/architecture.md §4 IPC Communication - Channel Naming Convention]

### Dependencies

- **External APIs:**
  - Stripe Checkout API (payment processing)
  - Stripe Connect API (creator payouts)
  - Stripe Webhooks (payment confirmation)

- **Internal Services:**
  - Epic 9 Story 5: Marketplace publishing pipeline (workflows must be published before they can be purchased)
  - Epic 9 Story 6: Marketplace discovery & installation (installation flow reused after purchase)

- **NPM Packages:**
  - `stripe` (v14.x) - Stripe Node.js library for backend
  - Electron `shell.openExternal()` - Open Stripe checkout in browser

### Testing Strategy

**Unit Tests:**
- `StripeServiceTest.java` - Test revenue split calculation, payout logic
- `ReputationServiceTest.java` - Test scoring algorithm with various inputs
- `BadgeServiceTest.java` - Test badge award criteria

**Integration Tests:**
- Stripe test mode with test card numbers (4242 4242 4242 4242)
- Webhook signature verification with test webhook secret
- Payout job with mock date/time for monthly execution

**E2E Tests:**
- Full purchase flow with Stripe mock (Playwright + intercept)
- Creator dashboard data display
- Payout history pagination

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e9-s7-freemium-business-model.context.xml

- docs/sprint-artifacts/e9-s7-freemium-business-model.context.xml



### Agent Model Used

<!-- Model name and version will be added during implementation -->

### Debug Log References

<!-- Links to debug logs will be added during implementation -->

### Completion Notes List

<!-- Completion notes will be added by dev agent after implementation -->

### File List

<!-- List of files created/modified will be added by dev agent after implementation -->
