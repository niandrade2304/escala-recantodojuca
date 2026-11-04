"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Escala, Funcionario, Turno } from "@/lib/tipos";
import {
  DIAS_SEMANA,
  diaMes,
  diasDaSemana,
  hojeISO,
  horaCurta,
  inicioDaSemana,
  paraData,
  somarDias,
} from "@/lib/datas";

type CelulaAberta = { data: string; turno: Turno };

function mensagemDeErro(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  return String(e);
}

function semAssinatura() {
  return () => {};
}

/** Chave de uma célula da grade: "2026-11-20|id-do-turno" */
function chaveCelula(data: string, turnoId: string) {
  return `${data}|${turnoId}`;
}

export default function EscalaDaSemana() {
  // A data de hoje é calculada no celular de quem abre a tela ("" enquanto carrega).
  const hoje = useSyncExternalStore(semAssinatura, hojeISO, () => "");
  // Quantas semanas para frente (+) ou para trás (-) da semana atual
  const [deslocamento, setDeslocamento] = useState(0);
  const segunda = hoje ? somarDias(inicioDaSemana(hoje), deslocamento * 7) : null;
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoSemana, setCarregandoSemana] = useState(true);
  const [celula, setCelula] = useState<CelulaAberta | null>(null);
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());

  // Turnos e funcionários: carregados uma vez
  useEffect(() => {
    async function carregarBase() {
      if (!variaveisConfiguradas()) {
        setErro("O banco de dados não está configurado. Veja a página Início.");
        return;
      }
      const db = supabase();
      const [t, f] = await Promise.all([
        db.from("turnos").select("id, nome, hora_inicio, hora_fim, ordem").order("ordem"),
        db.from("funcionarios").select("id, nome, funcao, telefone, cpf, ativo").order("nome"),
      ]);
      if (t.error || f.error) {
        setErro(mensagemDeErro(t.error ?? f.error));
        return;
      }
      setTurnos(t.data ?? []);
      setFuncionarios(f.data ?? []);
    }
    carregarBase();
  }, []);

  // Escala da semana: recarregada a cada troca de semana
  useEffect(() => {
    if (!segunda || !variaveisConfiguradas()) return;
    let cancelado = false;
    async function carregarSemana(inicio: string) {
      setCarregandoSemana(true);
      const { data, error } = await supabase()
        .from("escalas")
        .select("id, data, turno_id, funcionario_id")
        .gte("data", inicio)
        .lte("data", somarDias(inicio, 6));
      if (cancelado) return;
      if (error) setErro(mensagemDeErro(error));
      else setEscalas(data ?? []);
      setCarregandoSemana(false);
    }
    carregarSemana(segunda);
    return () => {
      cancelado = true;
    };
  }, [segunda]);

  const dias = useMemo(() => (segunda ? diasDaSemana(segunda) : []), [segunda]);

  const funcionarioPorId = useMemo(
    () => new Map(funcionarios.map((f) => [f.id, f])),
    [funcionarios],
  );

  // Quem está escalado em cada célula
  const porCelula = useMemo(() => {
    const mapa = new Map<string, Escala[]>();
    escalas.forEach((e) => {
      const chave = chaveCelula(e.data, e.turno_id);
      mapa.set(chave, [...(mapa.get(chave) ?? []), e]);
    });
    return mapa;
  }, [escalas]);

  function nomesNaCelula(data: string, turnoId: string): string[] {
    return (porCelula.get(chaveCelula(data, turnoId)) ?? [])
      .map((e) => funcionarioPorId.get(e.funcionario_id)?.nome ?? "?")
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  async function alternar(funcionario: Funcionario) {
    if (!celula) return;
    const { data, turno } = celula;
    const chaveOcupado = `${data}|${turno.id}|${funcionario.id}`;
    if (ocupados.has(chaveOcupado)) return;
    setOcupados((o) => new Set(o).add(chaveOcupado));

    const existente = escalas.find(
      (e) => e.data === data && e.turno_id === turno.id && e.funcionario_id === funcionario.id,
    );
    const db = supabase().from("escalas");
    if (existente) {
      const { error } = await db.delete().eq("id", existente.id);
      if (error) alert("Não foi possível tirar da escala: " + mensagemDeErro(error));
      else setEscalas((lista) => lista.filter((e) => e.id !== existente.id));
    } else {
      const { data: nova, error } = await db
        .insert({ data, turno_id: turno.id, funcionario_id: funcionario.id })
        .select("id, data, turno_id, funcionario_id")
        .single();
      if (error) alert("Não foi possível colocar na escala: " + mensagemDeErro(error));
      else if (nova) setEscalas((lista) => [...lista, nova]);
    }

    setOcupados((o) => {
      const novo = new Set(o);
      novo.delete(chaveOcupado);
      return novo;
    });
  }

  // Na janela da célula: ativos + inativos que já estavam escalados nela
  const opcoesDaCelula = useMemo(() => {
    if (!celula) return [];
    const escalados = new Set(
      (porCelula.get(chaveCelula(celula.data, celula.turno.id)) ?? []).map(
        (e) => e.funcionario_id,
      ),
    );
    return funcionarios
      .filter((f) => f.ativo || escalados.has(f.id))
      .map((f) => ({ funcionario: f, marcado: escalados.has(f.id) }));
  }, [celula, funcionarios, porCelula]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Escala da semana</h1>

      <div className="cartao space-y-3">
        <p className="text-center text-lg font-bold">
          {dias.length ? `${diaMes(dias[0])} a ${diaMes(dias[6])}` : "..."}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className="botao-secundario px-2"
            disabled={!segunda}
            onClick={() => setDeslocamento((d) => d - 1)}
          >
            ◀ Anterior
          </button>
          <button
            type="button"
            className="botao-secundario px-2"
            disabled={!segunda || deslocamento === 0}
            onClick={() => setDeslocamento(0)}
          >
            Hoje
          </button>
          <button
            type="button"
            className="botao-secundario px-2"
            disabled={!segunda}
            onClick={() => setDeslocamento((d) => d + 1)}
          >
            Próxima ▶
          </button>
        </div>
      </div>

      {erro && <p className="cartao text-red-700">Erro: {erro}</p>}

      {!erro && (
        <>
          <p className="text-sm text-neutral-600">
            Toque num quadro para escolher quem trabalha.
            {carregandoSemana && " Carregando..."}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-[1] w-24 border-b border-neutral-200 bg-white p-2 text-left">
                    Turno
                  </th>
                  {dias.map((dia) => {
                    const ehHoje = dia === hoje;
                    return (
                      <th
                        key={dia}
                        className="border-b border-l border-neutral-200 p-2 text-center"
                        style={ehHoje ? { background: "var(--cor-destaque)", color: "white" } : undefined}
                      >
                        <span className="block">{DIAS_SEMANA[paraData(dia).getDay()]}</span>
                        <span className="block font-normal">{diaMes(dia)}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {turnos.map((turno) => (
                  <tr key={turno.id}>
                    <th className="sticky left-0 z-[1] border-b border-neutral-200 bg-white p-2 text-left align-top">
                      <span className="block" style={{ color: "var(--cor-destaque)" }}>
                        {turno.nome}
                      </span>
                      <span className="block text-xs font-normal text-neutral-500">
                        {horaCurta(turno.hora_inicio)}–{horaCurta(turno.hora_fim)}
                      </span>
                    </th>
                    {dias.map((dia) => {
                      const nomes = nomesNaCelula(dia, turno.id);
                      return (
                        <td key={dia} className="border-b border-l border-neutral-200 p-1 align-top">
                          <button
                            type="button"
                            onClick={() => setCelula({ data: dia, turno })}
                            className="flex min-h-24 w-full flex-col items-stretch gap-1 rounded-lg p-1 text-left active:bg-neutral-100"
                          >
                            {nomes.length === 0 ? (
                              <span className="m-auto text-2xl text-neutral-300">+</span>
                            ) : (
                              nomes.map((nome, i) => (
                                <span
                                  key={i}
                                  className="rounded-md bg-secundaria px-1.5 py-1 text-xs font-semibold leading-tight"
                                >
                                  {nome}
                                </span>
                              ))
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {celula && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setCelula(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-neutral-200 p-5">
              <h2 className="text-xl font-bold">
                {celula.turno.nome} · {DIAS_SEMANA[paraData(celula.data).getDay()]}{" "}
                {diaMes(celula.data)}
              </h2>
              <p className="text-sm text-neutral-600">
                Marque quem trabalha. Cada toque já fica salvo.
              </p>
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto p-4">
              {opcoesDaCelula.map(({ funcionario, marcado }) => {
                const ocupado = ocupados.has(
                  `${celula.data}|${celula.turno.id}|${funcionario.id}`,
                );
                return (
                  <li key={funcionario.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 ${
                        marcado ? "border-principal bg-secundaria" : "border-neutral-200"
                      } ${ocupado ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="h-6 w-6 shrink-0 accent-principal"
                        checked={marcado}
                        disabled={ocupado}
                        onChange={() => alternar(funcionario)}
                      />
                      <span className="flex-1">
                        <span className="block font-semibold">{funcionario.nome}</span>
                        <span className="block text-sm text-neutral-600">
                          {funcionario.funcao}
                          {!funcionario.ativo && " · desativado"}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
              {opcoesDaCelula.length === 0 && (
                <li className="text-neutral-600">Nenhum funcionário ativo. Cadastre na tela Equipe.</li>
              )}
            </ul>
            <div className="border-t border-neutral-200 p-4">
              <button type="button" className="botao w-full" onClick={() => setCelula(null)}>
                Pronto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
