import BuilderCanvas from './BuilderCanvas';
import './builder.css';

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BuilderCanvas templateId={id} />;
}
