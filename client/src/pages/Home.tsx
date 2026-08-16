import { ArrowRight, ClipboardList, Utensils } from "lucide-react";

const mark = "/manus-storage/joao-caicara-mark_eadc19d3.png";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F4EC] text-[#133C4A]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <section>
            <img src={mark} alt="Símbolo João Caiçara" className="mb-8 h-20 w-20 object-contain" />
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-[#D95D39]">João Caiçara Tradição</p>
            <h1 className="max-w-md font-serif text-5xl font-bold leading-[0.98] tracking-tight sm:text-6xl">Operação que acompanha a maré.</h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-[#457B9D]">Acesse o sistema certo para cada função. Os dois ambientes compartilham as mesmas comandas e o mesmo Firebase.</p>
          </section>
          <section className="grid gap-4">
            <a href="/garcom/index.html" className="group rounded-2xl border border-[#0F4C5C]/10 bg-[#0F4C5C] p-6 text-white shadow-xl shadow-[#0F4C5C]/10 transition hover:-translate-y-1 hover:bg-[#133C4A] focus:outline-none focus:ring-4 focus:ring-[#D95D39]/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10"><Utensils size={24} /></div>
                  <h2 className="text-2xl font-bold">Sistema do garçom</h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-white/75">Mesas, comandas, pedidos e atendimento direto no celular.</p>
                </div>
                <ArrowRight className="transition group-hover:translate-x-1" />
              </div>
            </a>
            <a href="/pdv/index.html" className="group rounded-2xl border border-[#C49A6C]/30 bg-white p-6 shadow-xl shadow-[#133C4A]/5 transition hover:-translate-y-1 hover:border-[#D95D39]/40 focus:outline-none focus:ring-4 focus:ring-[#D95D39]/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#C49A6C]/20 text-[#0F4C5C]"><ClipboardList size={24} /></div>
                  <h2 className="text-2xl font-bold text-[#0F4C5C]">PDV — Caixa</h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[#457B9D]">Produção, fechamento de contas, cardápio e histórico.</p>
                </div>
                <ArrowRight className="text-[#D95D39] transition group-hover:translate-x-1" />
              </div>
            </a>
          </section>
        </div>
        <p className="mt-16 text-xs font-semibold uppercase tracking-[0.18em] text-[#457B9D]/70">Maré Operacional · acesso por função</p>
      </div>
    </main>
  );
}
