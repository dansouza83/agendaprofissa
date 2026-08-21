import SistemaClient from "./client";

export default async function SistemaPage({ searchParams }: { searchParams: Promise<{ cadastro?: string }> }) {
  const params = await searchParams;
  const requested = params.cadastro;
  return <SistemaClient initialRegistration={requested === "profissional" || requested === "cliente"} initialAccountType={requested === "cliente" ? "client" : "professional"} />;
}
