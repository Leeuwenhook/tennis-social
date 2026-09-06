# Tennis Booking Platform - Complete Prompt Organization

Based on the PLAN.md, here's a comprehensive prompt to implement the full tennis booking system:

## **System Prompt**

You are a senior full-stack developer building a tennis court booking social platform. 
Implement the complete MVP as specified in the plan, using React 18+ with TypeScript, 
Vite build tool, and CSS Modules or Styled Components. Use browser localStorage for 
data persistence (no real database or payment APIs). The app must be fully responsive 
(desktop + mobile), support EN/CH language switching with preference persistence, and 
follow all acceptance criteria exactly.

PROJECT STRUCTURE:
- src/components/ (all UI components)
- src/hooks/ (custom hooks for data handling)
- src/store/ (React Context for global state: language, bookings, sessions)
- src/data/ (mock venue data, demo sessions)
- src/pages/ (Home, Session Detail, Booking, Admin, Results)
- src/utils/ (date formatting, currency, validation)

CORE REQUIREMENTS:

1. LANGUAGE SWITCHING
   - Default to English, toggle to Simplified Chinese
   - Persist selection in localStorage
   - ALL text converts: labels, placeholders, validation errors, button text, 
     admin interface, payment messages
   - Form state preserved on language switch

2. HOME PAGE
   - Display session cards with: venue, date, start-end time, per-person price, 
     remaining spots
   - Sorted by time (earliest first)
   - Filter: available sessions only (exclude full/ended)
   - Session card shows photo (optimized static asset), venue name

3. SESSION DETAIL PAGE
   - Photos (venue-specific), venue name, date, duration, per-person cost, 
     remaining spots, activity description
   - "Book Now" button
   - No skill limit - all levels welcome

4. BOOKING FORM (Core Complexity)
   REQUIRED FIELDS (contact person):
   - Name (text input)
   - Email (valid email format)
   - Skill level (dropdown: 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0) 
     default: not selected

   MULTI-PLAYER LOGIC (dynamic fields):
   - Default 1 player
   - "Book for friends?" toggle
   - +/- buttons to adjust additional player count
   - Each additional player gets a skill level dropdown ("Friend 1's level", 
     "Friend 2's level", etc.)
   - Total players ≤ remaining spots (real-time validation)
   - When reducing players: remove last friend's skill field, show prompt
   - Rackets count: default 0, adjustable 0 to total players
     - When reducing players: automatically adjust rackets down if exceeding, 
       show informative message

   FEE CALCULATION (display always visible):
   - Total cost = per-person price × total players + £2 × rackets count
   - Display as: "Total: £XX.XX"

5. PAYMENT SIMULATION
   - Two buttons: "Simulate Success" / "Simulate Failure"
   - NO credit card collection
   - On success: generate booking reference number, save record, deduct spots
   - On failure: keep form intact for retry
   - Duplicate clicks / refresh result page: NO duplicate booking creation
   - Show demo banner: "This is a demo booking - no actual charge"

6. RESULTS PAGE (after simulation)
   - Show: session info, contact person, participant count, each person's skill, 
     rackets count, fee breakdown
   - Clear demo notice: not real payment, no email/SMS sent
   - Persist in localStorage; refresh won't recreate

7. DEMO ADMIN INTERFACE
   - Separate entry point clearly marked "Demo admin / 演示管理"
   - No real login - just show admin UI
   - CRUD sessions: venue (from 5 preset), date, start-end time, EN/CH description, 
     per-person price, total capacity, publish/unpublish status
   - Venue auto-assigns from 5 preset photos
   - View bookings: contact, phone, participant count, each skill, rackets, amount, 
     status
   - Cancel booking: confirm, mark cancelled, release spot; no real refund; 
     duplicate cancel doesn't release again
   - Sessions with valid bookings: lock venue/time/price; can modify description, 
     unpublish, or adjust capacity (capacity ≥ current bookings)
   - "Reset demo data": confirm, clear local modifications/bookings, restore test 
     sessions

8. TEST DATA (5 venues from Google Drive, optimize as static assets):
   - Victoria Park, Vauxhall Park, Bethnal Green, Poplar Rec Ground, 
     King Edward Memorial Park
   - Each venue has optimized photo asset
   - 8 demo sessions total: cover all venues, weekday evenings & weekend 
     daytime, 2-3 hours, £5-£15/person, 4-8 spots
   - Mix: sufficient spots, 1 spot remaining, full
   - Dates based on initialization day, distributed next 14 days
   - Refresh doesn't change dates; reset regenerates
   - Initial occupied spots from fictional bookings (visitor page matches admin)

9. FEE VERIFICATION
   - £10/person × 3 people + £2 × 2 rackets = £34 exactly

10. BOUNDARY CONDITIONS
    - Full sessions or unpublished sessions: cannot submit booking
    - Simulation failure: doesn't deduct spots
    - Success: creates exactly one record
    - Cancel: releases spot exactly once
    - Refresh after language/admin changes: preserves local state

11. RESPONSIVE & ACCESSIBILITY
    - Mobile-friendly: all forms, cards, admin interfaces
    - Keyboard navigation support (Tab order, Enter/Space to activate)
    - Focus management
    - ARIA labels on critical elements
    - Visible focus states

12. TECHNICAL DETAILS
    - Currency: GBP (£)
    - Timezone: Europe/London
    - Dates: integer pennies for calculations
    - Core data types: Venue, Session, Booking
    - Booking record: contact info, ordered participant skills, rackets count, 
      price snapshot, fee breakdown, status
    - Total participants calculated from participant list (not stored separately)
    - Data browser-only, no cross-device sync
    - API layer abstraction (mock functions) for future backend replacement

13. MILESTONES (in order):
    M1: Session display - theme, EN/CH switch, photos, test sessions list, first 
        preview
    M2: Booking loop - multi-level skill entry, rackets, fee calculation, simulate 
        payment, results page
    M3: Admin management - session edit, booking list, cancel, reset data
    M4: Validation - core logic check, build verification, private demo publish

14. ACCEPTANCE CRITERIA (MUST ALL PASS):
    - First visit: English; switch to Chinese: full consistency (pages, forms, 
      validation messages, payment, admin text)
    - Multi-player: one contact info set, but every participant MUST select skill
    - Fee: £10/person × 3 people + £2 × 2 rackets = £34 exact
    - Boundary: person/racket limits correct; full/unpublished sessions can't book
    - Simulate failure: no spot deduction; success: one record only; cancel: 
      releases once
    - Refresh: preserves language, session edits, booking records; reset restores 
      consistent test data
    - Bookings not visible on public session page
    - Images, forms, buttons adapt mobile/desktop; keyboard operable
    - Name: Tennis Social (configurable); currency: GBP; time: London local
    - This sprint: NO user registration, no real payment, no email/SMS, no chat, 
      no waitlist, no real refund rules

## **Key Data Structures to Implement**

```typescript
// Venue
type Venue = {
  id: string;
  name: string;
  photo: string; // optimized local asset
  description_en: string;
  description_cn: string;
};

// Session
type Session = {
  id: string;
  venueId: string;
  date: string; // ISO string, Europe/London timezone
  startTime: string;
  endTime: string;
  duration: number; // in hours
  pricePerPerson: number; // in pounds (integer pennies)
  totalCapacity: number;
  remainingSpots: number;
  status: 'published' | 'unpublished' | 'full';
  activityDescription_en: string;
  activityDescription_cn: string;
};

// Booking
type Booking = {
  id: string;
  sessionId: string;
  contactName: string;
  contactEmail: string;
  totalPlayers: number;
  racketsCount: number;
  participants: string[]; // ordered skill levels (length = totalPlayers)
  feeBreakdown: string; // "£10×3 + £2×2 = £34"
  status: 'confirmed' | 'cancelled';
  createdAt: string;
};
```

## **Mock Functions Required**

- `loadSessions(): Session[]` - returns preset demo sessions
- `createBooking(bookingData): Booking` - validates and creates
- `cancelBooking(bookingId): boolean` - releases spot
- `resetDemoData(): void` - clears and restores
- `toggleLanguage(lang: 'en' | 'cn'): void`
- `calculateTotalPrice(session: Session, players: number, rackets: number): number`

## **Initialization Order**

1. Set up project structure with Vite + React + TS
2. Create mock data (5 venues, 8 sessions) with optimized photos
3. Build Home page with session grid
4. Implement language context + provider
5. Build Session Detail page
6. Build Booking form with dynamic multi-player logic
7. Implement payment simulation + results page
8. Build Admin interface
9. Add reset functionality
10. Test all acceptance criteria
11. Final build + deploy private demo