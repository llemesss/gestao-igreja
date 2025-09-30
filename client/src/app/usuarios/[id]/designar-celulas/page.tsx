import DesignarCelulasClient from './DesignarCelulasClient';

export async function generateStaticParams() {
  return [];
}

export default function DesignarCelulasPage({ params }: { params: { id: string } }) {
  return <DesignarCelulasClient params={params} />;
}