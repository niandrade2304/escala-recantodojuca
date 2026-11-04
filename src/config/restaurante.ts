// Dados do restaurante descritos pelo dono.
// Por enquanto, turnos, funções e funcionários são os de exemplo do banco;
// os dados de verdade entram depois.

export const RESTAURANTE = {
  nome: "Restaurante Praiano O Rei do Abadejo",
  tipo: "Restaurante praiano",
  funcionamento: "A definir (usando os turnos de exemplo do banco)",
  turnos: [
    { nome: "Almoço", horaInicio: "11:00", horaFim: "15:30" },
    { nome: "Jantar", horaInicio: "18:00", horaFim: "23:30" },
  ],
  funcoes: ["Salão", "Cozinha", "Caixa", "Bar", "Entregador"],
  minimos: "A definir",
  folgasPorSemana: null as number | null,
  podeFecharEAbrir: null as boolean | null,
  regrasExtras: [] as string[],
  corPrincipal: "#C8102E",
  corSecundaria: "#FFF8D6",
  temLogo: true,
};
