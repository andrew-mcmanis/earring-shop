import type { Metadata } from 'next';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { ReviewForm } from './ReviewForm';

export const metadata: Metadata = {
  title: 'Leave a review',
  robots: { index: false }, // submission page — keep out of search
};

export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  return (
    <>
      <Header />
      <div className="max-w-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-ink mb-2">Leave a review</h1>
        <p className="font-body text-base text-ink-light mb-8">
          {ref ? `Thanks for order ${ref}. ` : ''}We&apos;d love to hear what you thought.
        </p>
        <ReviewForm orderReference={ref ?? null} />
      </div>
      <Footer />
    </>
  );
}
