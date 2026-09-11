export const config = {
  runtime: 'edge', // Usa o ambiente de borda do Vercel
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req) {
  // Responde ao preflight request do navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Recebe o PDF enviado pelo frontend
    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file) {
      throw new Error("Nenhum arquivo enviado.");
    }

    // 2. Converte o PDF para Base64
    const arrayBuffer = await file.arrayBuffer();
    const base64PDF = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    );

    // Pega a variável de ambiente cadastrada no Vercel
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // 3. Monta o Prompt Rigoroso
    const prompt = `
      Você é um orçamentista técnico da BMW. Leia o manual de reparação em PDF anexo.
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
    `;

    // 4. Faz a requisição para a API do Gemini
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "application/pdf", data: base64PDF } }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json",
        }
      })
    });

    const aiData = await geminiResponse.json();
    
    // Verifica se houve erro na resposta da IA
    if (aiData.error) {
      throw new Error(aiData.error.message);
    }

    const jsonString = aiData.candidates[0].content.parts[0].text;
    
    // 5. Devolve o JSON para o frontend
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
