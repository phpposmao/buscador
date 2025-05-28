// @ts-nocheck
import SearchForm from "@/components/search-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Buscador de Estabelecimentos",
  description: "Encontre estabelecimentos e exporte os dados para Excel",
}

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-12 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-orange-500 sm:text-4xl mb-2">Buscador de Estabelecimentos</h1>
          <p className="text-lg text-muted-foreground">
            Encontre estabelecimentos por tipo e localização e exporte os dados para Excel
          </p>
        </div>

        <SearchForm />
      </div>
    </main>
  )
}
