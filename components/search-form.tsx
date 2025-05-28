// @ts-nocheck
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Search, Loader2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

type FormData = {
  serviceType: string
  location: string
}

export default function SearchForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [resultsCount, setResultsCount] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>()

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true)
      setError(null)
      setDownloadUrl(null)

      const response = await fetch("/api/search-places", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Ocorreu um erro ao buscar os estabelecimentos")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      setDownloadUrl(url)

      // Extrair o número de resultados do cabeçalho da resposta
      const count = response.headers.get("X-Results-Count")
      setResultsCount(count ? Number.parseInt(count) : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro ao buscar os estabelecimentos")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="serviceType">Tipo de Serviço</Label>
            <Input
              id="serviceType"
              placeholder="Ex: restaurante, academia, farmácia"
              {...register("serviceType", { required: "Tipo de serviço é obrigatório" })}
            />
            {errors.serviceType && <p className="text-sm text-red-500">{errors.serviceType.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Localização</Label>
            <Input
              id="location"
              placeholder="Ex: São Paulo, Pinheiros, 04532-000"
              {...register("location", { required: "Localização é obrigatória" })}
            />
            {errors.location && <p className="text-sm text-red-500">{errors.location.message}</p>}
          </div>
        </div>

        <div className="flex justify-center">
          <Button type="submit" disabled={isLoading} className="w-full bg-orange-500 hover:bg-orange-400 sm:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Buscar Estabelecimentos
              </>
            )}
          </Button>
        </div>
      </form>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {downloadUrl && (
        <div className="mt-6 text-center">
          <Alert className="mb-4">
            <AlertDescription>
              {resultsCount
                ? `${resultsCount} estabelecimentos encontrados! Clique abaixo para baixar a planilha.`
                : "Planilha gerada com sucesso! Clique abaixo para baixar."}
            </AlertDescription>
          </Alert>

          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href={downloadUrl} download="estabelecimentos.xlsx">
              <Download className="mr-2 h-4 w-4" />
              Baixar Planilha Excel
            </a>
          </Button>
        </div>
      )}
    </Card>
  )
}
