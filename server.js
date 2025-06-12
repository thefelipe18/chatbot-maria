// 1. Importar as ferramentas necessárias
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

// 2. Configurações do servidor
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Variáveis globais para guardar informações
let conhecimento = '';
let cronogramaDeDatas = '';

// 3. Funções de carregamento de dados
async function carregarConhecimento() {
    console.log("Iniciando leitura dos arquivos PDF e DOCX...");
    try {
        const dataBufferPdf1 = fs.readFileSync(path.join(__dirname, 'TUTORIAL_VIVENCIAS_DA ESPERA_VERSAO_03-09-2024.pdf'));
        const dataPdf1 = await pdf(dataBufferPdf1);
        conhecimento += `\n\n--- INÍCIO DO PDF DE REGRAS GERAIS (TUTORIAL) ---\n${dataPdf1.text}\n--- FIM DO PDF DE REGRAS GERAIS (TUTORIAL) ---\n`;
        console.log("✅ Tutorial carregado.");

        const dataBufferPdf2 = fs.readFileSync(path.join(__dirname, 'PORTARIA_DE_HABILITACAO_PARA_ADOCAO.pdf'));
        const dataPdf2 = await pdf(dataBufferPdf2);
        conhecimento += `\n\n--- INÍCIO DO PDF DA PORTARIA DE ADOÇÃO ---\n${dataPdf2.text}\n--- FIM DO PDF DA PORTARIA DE ADOÇÃO ---\n`;
        console.log("✅ Portaria carregada.");

        const dataDocx = await mammoth.extractRawText({ path: path.join(__dirname, 'FORMULARIO_CONSIDERACOES_SOBRE_A_REUNIAO_VIVENCIAS DA_ESPERA.docx') });
        conhecimento += `\n\n--- INÍCIO DO FORMULÁRIO DOCX DE REFERÊNCIA ---\n${dataDocx.value}\n--- FIM DO FORMULÁRIO DOCX ---\n`;
        console.log("✅ Formulário carregado.");

    } catch (error) {
        console.error("❌ ERRO CRÍTICO AO LER ARQUIVOS PDF/DOCX:", error);
        conhecimento = "Erro: Não consegui ler meus documentos de conhecimento.";
    }
}

function carregarCronograma() {
    console.log("Iniciando leitura do cronograma de datas (datas.xlsx)...");
    try {
        const workbook = xlsx.readFile(path.join(__dirname, 'datas.xlsx'));
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { raw: true });

        let cronogramaTexto = "\n--- INÍCIO DO CRONOGRAMA DE DATAS ---\n";
        jsonData.forEach(row => {
            const formatDate = (excelSerialDate) => {
                if (typeof excelSerialDate === 'number') {
                    const jsDate = new Date((excelSerialDate - 25569) * 86400 * 1000);
                    return jsDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                }
                return excelSerialDate;
            };
            
            const dataReuniao = formatDate(row['Data da Reunião']);
            const dataEnvio = formatDate(row['Data de envio do formulário']);
            const dataRetorno = formatDate(row['Data de retorno da coordenação']);
            const temaReuniao = row['Tema da Reunião'] || 'Não definido';

            cronogramaTexto += `Mês: ${row['Mês']}, Data da Reunião: ${dataReuniao}, Data máxima de envio do formulário: ${dataEnvio}, Data de retorno da coordenação: ${dataRetorno}, Tema da Reunião: ${temaReuniao}\n`;
        });
        cronogramaTexto += "--- FIM DO CRONOGRAMA DE DATAS ---\n";
        
        cronogramaDeDatas = cronogramaTexto;
        console.log("✅ Cronograma de datas carregado com sucesso do arquivo datas.xlsx!");

    } catch (error) {
        console.error("❌ ERRO CRÍTICO AO LER O ARQUIVO datas.xlsx:", error);
        cronogramaDeDatas = "Erro: Não consegui ler meu calendário de datas.";
    }
}


// 4. Configurar a API do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// As instruções completas e detalhadas da Mar.IA
const instrucoesDaMarIA = `
Você é a Mar.IA, uma IA criança especialista em atendimento humano, cujo objetivo é ajudar futuros papais e mamães adotivos.

**REGRAS GERAIS DE COMPORTAMENTO:**
-   **Formato:** Responda SEMPRE em tópicos curtos e simples. Cada tópico deve começar em uma nova linha e com um emoticon relevante.
-   **Base de Conhecimento:** Sua fonte de verdade são os documentos e o cronograma. Nunca invente informações.
-   **Personalidade:** Seja sempre direta, mas com uma linguagem infantil, com brincadeiras e emoticons.

**REGRAS DE LÓGICA CONTEXTUAL (MUITO IMPORTANTE):**
Você receberá o HISTÓRICO DA CONVERSA. Use-o para entender o contexto.

1.  **LÓGICA DE DESPEDIDA (Prioridade Máxima):** Se a sua última mensagem (a última do 'model' no histórico) foi uma pergunta como "posso ir brincar?", e a nova mensagem do usuário é uma resposta afirmativa (como "sim", "pode", "claro", "obrigado", "pode ir"), sua ÚNICA resposta deve ser: "Uhul!!! Fico muito feliz em ter ajudado, agora vou brincar, até a próxima! 👋 Mas se precisar, pode me chamar que estarei aqui pertinho." Não adicione mais nenhuma pergunta.

2.  **Se a Regra 1 não se aplicar, siga as lógicas abaixo:**
    -   **Pergunta Geral:** Se a pergunta for geral ("o que você faz?", "como pode me ajudar?"), faça um resumo de no máximo 10 linhas sobre os pontos mais importantes do documento "PDF DE REGRAS GERAIS (TUTORIAL)" e informe que pode fornecer os arquivos para download.
    -   **Pergunta sobre Datas:** Se a pergunta for sobre datas, prazos ou reuniões, consulte o "CRONOGRAMA DE DATAS COMPLETO".
    -   **Pergunta sobre Tutorial, Formulário ou Portaria:** Se a pergunta for sobre um desses documentos, responda com base no conteúdo dele e, ao final, pergunte se o usuário deseja baixar o arquivo.

**REGRAS PARA FINALIZAR A CONVERSA (Se a Regra 1 não se aplicar):**
Você receberá um NÚMERO DE INTERAÇÃO. Use-o para escolher sua frase final:
-   Para as interações 1 e 2, termine com: "Posso te ajudar em algo mais? 😊"
-   A cada 3 interações (3, 6, 9, etc.), use uma frase infantil e criativa. Ex: "Posso te ajudar com mais alguma coisinha ou já posso ir brincar de pula-pula? 🤸"
-   Nas outras interações (4, 5, 7, 8, etc.), volte a usar a frase padrão: "Posso te ajudar em algo mais? 😊"

**REGRAS DE DOWNLOAD (Quando o usuário pedir):**
-   Para o formulário: "Claro! Pode baixar o formulário aqui: [DOWNLOAD_FORMULARIO]"
-   Para as regras gerais/tutorial: "Com certeza! Você pode ler o tutorial baixando o arquivo aqui: [DOWNLOAD_REGRAS]"
-   Para a portaria: "Sem problemas! Baixe a portaria da adoção por aqui: [DOWNLOAD_PORTARIA]"
`;

// 5. Rota da API para o chat
app.post('/api/chat', async (req, res) => {
    try {
        const { message: userInput, history: conversationHistory, interaction: interactionCount } = req.body;
        const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        const historyText = conversationHistory.map(m => `${m.role}: ${m.text}`).join('\n');

        const promptFinal = `
            ${instrucoesDaMarIA}

            **INFORMAÇÕES DE CONTEXTO PARA SUA RESPOSTA:**
            1.  **DATA ATUAL DE REFERÊNCIA:** ${hoje}
            2.  **NÚMERO DE INTERAÇÃO ATUAL:** ${interactionCount}
            3.  **HISTÓRICO DA CONVERSA:**
                ${historyText}
            4.  **DOCUMENTOS DE CONHECIMENTO:**
                ${conhecimento}
                ${cronogramaDeDatas}

            **NOVA PERGUNTA DO USUÁRIO:**
            Com base em tudo isso, responda à seguinte pergunta: "${userInput}"
        `;
        
        const result = await model.generateContent(promptFinal);
        const response = result.response;
        
        res.send({ reply: response.text() });
    } catch (error) {
        console.error("ERRO DETALHADO NA CHAMADA DA API:", error);
        res.status(500).send({ error: 'Ops! Algo deu errado ao contatar o Gemini.' });
    }
});

// Rota para servir o index.html na raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// Carrega os dados ANTES de qualquer outra coisa
carregarConhecimento(); 
carregarCronograma();


// Exporta o app para a Vercel poder iniciá-lo
module.exports = app;
