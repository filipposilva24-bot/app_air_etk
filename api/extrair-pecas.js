export const config = {
  runtime: 'edge',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Recebe o texto do manual enviado pelo navegador
    const body = await req.json();
    const textoManual = body.textoManual;

    if (!textoManual) {
      throw new Error("Nenhum texto encontrado no manual.");
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // Prompt rigoroso adaptado para receber texto direto
    const prompt = `
      Você é um orçamentista técnico da BMW. Leia o manual de reparação abaixo.
      Extraia TODAS as peças de substituição obrigatória, peças recomendadas e fluidos mencionados.
      Agrupe os resultados utilizando os Grupos e Subgrupos oficiais do ETK da BMW (ex: "Grupo 33 - Eixo Traseiro").
      Retorne ESTRITAMENTE um array JSON. Não adicione nenhum texto antes ou depois.
      
      Formato exigido:
      [
        {
          "grupo": "Nome do Grupo ETK",
          "pecas": [
            { "qtd": "1", "nome": "Nome Curto da Peça" }
          ]
        }
      ]

      MANUAL DE REPARO:
      ${textoManual}
    `;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          response_mime_type: "application/json",
        }
      })
    });

    const aiData = await geminiResponse.json();
    
    if (aiData.error) {
      throw new Error(aiData.error.message);
    }

    const jsonString = aiData.candidates[0].content.parts[0].text;
    
    return new Response(jsonString, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}
