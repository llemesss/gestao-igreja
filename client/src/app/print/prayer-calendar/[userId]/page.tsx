import PrayerCalendarPrintClient from './PrayerCalendarPrintClient';

export async function generateStaticParams() {
  return [];
}

export default function PrayerCalendarPrintPage({ params }: { params: { userId: string } }) {
  return <PrayerCalendarPrintClient params={params} />;
}