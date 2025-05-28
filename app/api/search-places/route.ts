// @ts-nocheck

import { type NextRequest, NextResponse } from "next/server"
import axios from "axios"
import ExcelJS from "exceljs"

// Tipos para os dados da API do Google Places
type PlaceSearchResult = {
  place_id: string
  name: string
  vicinity: string
  rating?: number
  user_ratings_total?: number
  types: string[]
  website?: string
  formatted_phone_number?: string
  formatted_address?: string
}

type PlacesSearchResponse = {
  results: Array<{
    place_id: string
    name: string
    vicinity: string
    rating?: number
    user_ratings_total?: number
    types: string[]
  }>
  next_page_token?: string
  status: string
}

type PlaceDetailsResponse = {
  result: {
    website?: string
    formatted_phone_number?: string
    formatted_address: string
  }
  status: string
}

// Função para buscar detalhes de um lugar específico
async function getPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetailsResponse> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number,formatted_address&key=${apiKey}`

  const response = await axios.get(url)
  return response.data
}

// Função para buscar lugares com base no tipo e localização
async function searchPlaces(
  serviceType: string,
  location: string,
  apiKey: string,
  pageToken?: string,
): Promise<PlacesSearchResponse> {
  // Primeiro, geocodificar a localização para obter coordenadas
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`
  const geocodeResponse = await axios.get(geocodeUrl)

  if (geocodeResponse.data.status !== "OK" || !geocodeResponse.data.results[0]) {
    throw new Error("Não foi possível encontrar a localização especificada")
  }

  const { lat, lng } = geocodeResponse.data.results[0].geometry.location

  // Agora, buscar lugares próximos à localização
  let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&keyword=${encodeURIComponent(serviceType)}&key=${apiKey}`

  if (pageToken) {
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${apiKey}`
  }

  const response = await axios.get(url)
  return response.data
}

// Função para processar todos os resultados, incluindo paginação
async function getAllPlaces(serviceType: string, location: string, apiKey: string): Promise<PlaceSearchResult[]> {
  let allResults: PlaceSearchResult[] = []
  let nextPageToken: string | undefined = undefined
  const maxPages = 3 // Limitar a 3 páginas (60 resultados) para evitar exceder limites da API
  let currentPage = 0

  do {
    // Aguardar um pouco se estiver usando um token de página
    // A API do Google às vezes precisa de tempo para processar o token
    if (nextPageToken) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    const response = await searchPlaces(serviceType, location, apiKey, nextPageToken)

    if (response.status !== "OK") {
      throw new Error(`Erro na API do Google Places: ${response.status}`)
    }

    // Para cada resultado, buscar detalhes adicionais
    const detailedResults = await Promise.all(
      response.results.map(async (place) => {
        try {
          const details = await getPlaceDetails(place.place_id, apiKey)

          return {
            ...place,
            website: details.result.website || "",
            formatted_phone_number: details.result.formatted_phone_number || "",
            formatted_address: details.result.formatted_address || place.vicinity,
          }
        } catch (error) {
          console.error(`Erro ao buscar detalhes para ${place.name}:`, error)
          return {
            ...place,
            website: "",
            formatted_phone_number: "",
            formatted_address: place.vicinity,
          }
        }
      }),
    )

    allResults = [...allResults, ...detailedResults]
    nextPageToken = response.next_page_token
    currentPage++
  } while (nextPageToken && currentPage < maxPages)

  return allResults
}

// Função para gerar planilha Excel
async function generateExcel(places: PlaceSearchResult[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Estabelecimentos")

  // Definir cabeçalhos
  worksheet.columns = [
    { header: "Nome", key: "name", width: 30 },
    { header: "Endereço", key: "address", width: 40 },
    { header: "Avaliação", key: "rating", width: 12 },
    { header: "Número de Avaliações", key: "ratings_count", width: 20 },
    { header: "Possui Site", key: "has_website", width: 12 },
    { header: "Site", key: "website", width: 40 },
    { header: "Telefone", key: "phone", width: 20 },
    { header: "Tipo de Negócio", key: "business_type", width: 30 },
  ]

  // Estilizar cabeçalhos
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  }

  // Adicionar dados
  places.forEach((place) => {
    const businessType = place.types
      .filter((type) => !["point_of_interest", "establishment"].includes(type))
      .map((type) => type.replace(/_/g, " "))
      .join(", ")

    worksheet.addRow({
      name: place.name,
      address: place.formatted_address,
      rating: place.rating || "N/A",
      ratings_count: place.user_ratings_total || 0,
      has_website: place.website ? "Sim" : "Não",
      website: place.website || "N/A",
      phone: place.formatted_phone_number || "N/A",
      business_type: businessType || "N/A",
    })
  })

  // Formatar células
  worksheet.getColumn("rating").numFmt = "0.0"

  // Adicionar filtros
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 8 },
  }

  // Congelar a primeira linha
  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }]

  // Gerar buffer
  return await workbook.xlsx.writeBuffer()
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ message: "Chave da API do Google Maps não configurada" }, { status: 500 })
    }

    const body = await request.json()
    const { serviceType, location } = body

    if (!serviceType || !location) {
      return NextResponse.json({ message: "Tipo de serviço e localização são obrigatórios" }, { status: 400 })
    }

    // Buscar todos os lugares
    const places = await getAllPlaces(serviceType, location, apiKey)

    if (places.length === 0) {
      return NextResponse.json(
        { message: "Nenhum estabelecimento encontrado para os critérios informados" },
        { status: 404 },
      )
    }

    // Gerar planilha Excel
    const excelBuffer = await generateExcel(places)

    // Retornar a planilha como download
    const response = new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=estabelecimentos.xlsx",
        "X-Results-Count": places.length.toString(),
      },
    })

    return response
  } catch (error) {
    console.error("Erro ao processar a requisição:", error)

    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro ao processar a requisição"

    return NextResponse.json({ message: errorMessage }, { status: 500 })
  }
}
