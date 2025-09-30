import DesignarPessoasClient from './DesignarPessoasClient';

export async function generateStaticParams() {
  return [];
}

export default function DesignarPessoasPage({ params }: { params: { id: string } }) {
  return <DesignarPessoasClient params={params} />;
}