import CellDetailClient from './CellDetailClient';

// Função necessária para export estático
export async function generateStaticParams() {
  return [];
}

export default function CellDetailPage() {
  return <CellDetailClient />;
}