import type { Metadata } from 'next';

import { ReviewForm } from '@/components/review-form';

export const metadata: Metadata = {
  title: 'Leave a review | Tennis Match',
  description: 'Tell other players how your Tennis Match session went.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return <ReviewForm />;
}
