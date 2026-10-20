import type { Metadata } from 'next';

import { ReviewForm } from '@/components/review-form';
import { SiteAnalytics } from '@/components/site-analytics';

export const metadata: Metadata = {
  title: 'Leave a review | Tennis Match',
  description: 'Tell other players how your Tennis Match session went.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  // A fixed path keeps the signed review token out of analytics.
  return (
    <>
      <ReviewForm />
      <SiteAnalytics route="/review" path="/review" />
    </>
  );
}
