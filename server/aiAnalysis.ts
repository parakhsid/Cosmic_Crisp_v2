import {GoogleGenAI, Type} from '@google/genai';
import {ECOCROP_BY_ID} from '../src/data/ecoCrop.ts';
import type {
  CropPrediction,
  FarmInsightBundle,
  LanguageCode,
} from '../src/types/agronomy.ts';

export interface GeospatialLayerSummary {
  mean: number | null;
  min: number | null;
  max: number | null;
  validPixels: number;
  units: string;
  dataset: string;
  notes?: string;
}

export interface GeospatialIngestionPayload {
  ingestedAt: string;
  location: {lat: number; lon: number};
  unifiedGrid: {
    crs: string;
    bbox: number[];
    shape: number[];
  };
  sources: {
    planetaryComputer?: {
      status: string;
      stacEndpoint?: string;
      gridCrs?: string;
      layers: Record<string, GeospatialLayerSummary>;
      warnings?: string[];
      error?: string;
    };
    nasaEarthdata?: {
      status: string;
      message?: string;
      gridCrs?: string;
      layers: Record<string, GeospatialLayerSummary>;
      warnings?: string[];
      error?: string;
    };
    isricSoilGrids?: {
      status: string;
      vrtBase?: string;
      gridCrs?: string;
      scalingFactor?: string;
      layers: Record<string, GeospatialLayerSummary>;
      warnings?: string[];
      error?: string;
    };
  };
}

export interface AiAgronomyAnalysis {
  headline: string;
  executiveSummary: string;
  recommendedNextCrop: string;
  soilAndMoistureDiagnosis: string;
  terrainAndSeasonRisk: string;
  actionChecklist: string[];
  dataProvenanceNotes: string;
  analyzedAt: string;
  model: string;
}

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  es: 'Spanish',
  hi: 'Hindi',
  fr: 'French',
  pt: 'Portuguese',
};

let cachedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment');
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export async function analyzeGeospatialWithGemini(input: {
  locationName: string;
  lang: LanguageCode;
  geospatial: GeospatialIngestionPayload;
  bundle?: FarmInsightBundle;
  farmerInputs: {
    currentCropId: string;
    harvestMonth: number;
    areaAcres: number;
    waterAvailability: string;
    laborAvailability: string;
    slopeClass: string;
    ownedEquipment: string[];
  };
  topPredictions: CropPrediction[];
}): Promise<AiAgronomyAnalysis> {
  const ai = getGeminiClient();
  const targetLanguage = LANGUAGE_NAMES[input.lang] ?? 'English';

  const promptPayload = {
    locationName: input.locationName,
    responseLanguage: targetLanguage,
    farmerInputs: input.farmerInputs,
    extractedXarrayLayers: input.geospatial.sources,
    unifiedGrid: input.geospatial.unifiedGrid,
    topStatisticalCandidates: input.topPredictions.slice(0, 6).map((p) => {
      const eco = ECOCROP_BY_ID[p.cropId];
      return {
        cropId: p.cropId,
        commonName: eco?.CommonName ?? p.cropId,
        scientificName: eco?.ScientificName ?? '',
        category: eco?.CAT ?? '',
        score: p.score,
        expectedYieldTHa: p.expectedYieldTHa,
        roiPct: p.roiPct,
        estNetMarginUsdHa: p.estNetMarginUsdHa,
        growingDays: p.growingDays,
        seasonFitsWindow: p.seasonFitsWindow,
        laborFits: p.laborFits,
        slopeSuitable: p.slopeSuitable,
        missingEquipment: p.missingEquipment,
        isTraditionalRegional: p.isTraditionalRegional,
        regionalRank: p.regionalRank,
      };
    }),
    regionalZoneLabel: input.bundle?.location.regionalZoneLabel,
    regionalSource: input.bundle?.location.regionalSource,
    currentSnapshot: input.bundle?.currentSnapshot,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents:
      `Analyze the extracted xarray satellite, terrain, climate, and soil statistics alongside the farmer's constraints and statistical crop rotation candidates. Provide practical, farmer-friendly agronomic guidance in ${targetLanguage}.\n\nDATA:\n` +
      JSON.stringify(promptPayload),
    config: {
      systemInstruction:
        `You are a senior precision agronomist advising practical farmers. Ground every insight directly in the numerical xarray layer statistics (NASADEM slope degrees, MODIS 12Q2 growing season days, ERA5/GPM precipitation/humidity/Tmin, SMAP L4 surface/rootzone moisture if available, and ISRIC SoilGrids 250m pH/SOC/clay/sand). Respond strictly in ${targetLanguage}. Keep sentences concise and actionable.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: {
            type: Type.STRING,
            description: 'Short 6-10 word headline for the field recommendation.',
          },
          executiveSummary: {
            type: Type.STRING,
            description:
              '2-3 sentence summary explaining the best next crop and why it matches satellite soil, moisture, slope, and season data.',
          },
          recommendedNextCrop: {
            type: Type.STRING,
            description: 'Name of the top recommended next crop.',
          },
          soilAndMoistureDiagnosis: {
            type: Type.STRING,
            description:
              'Specific interpretation of SoilGrids pH/SOC/clay/sand and SMAP/ERA5 moisture values.',
          },
          terrainAndSeasonRisk: {
            type: Type.STRING,
            description:
              'Assessment of NASADEM slope in degrees, MODIS growing season length, and minimum temperature/humidity risk.',
          },
          actionChecklist: {
            type: Type.ARRAY,
            items: {type: Type.STRING},
            description:
              '3-4 concrete field steps covering planting window, soil prep, water/labor, and machinery.',
          },
          dataProvenanceNotes: {
            type: Type.STRING,
            description:
              'Brief note summarizing which live xarray datasets contributed and any missing credentials (e.g., Earthdata).',
          },
        },
        required: [
          'headline',
          'executiveSummary',
          'recommendedNextCrop',
          'soilAndMoistureDiagnosis',
          'terrainAndSeasonRisk',
          'actionChecklist',
          'dataProvenanceNotes',
        ],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  const parsed = JSON.parse(text) as Omit<
    AiAgronomyAnalysis,
    'analyzedAt' | 'model'
  >;

  return {
    ...parsed,
    analyzedAt: new Date().toISOString(),
    model: 'gemini-4-hydrogen',
  };
}
