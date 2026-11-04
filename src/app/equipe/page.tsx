"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import { FUNCOES_PADRAO, type Funcionario } from "@/lib/tipos";

type Formulario = {
  id: string | null; // null = funcionário novo
  nome: string;
  funcao: string;
  telefone: string;
};

const FORMULARIO_VAZIO: Formulario = { id: null, nome: "", funcao: "", telefone: "" };

function mensagemDeErro(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  return String(e);
}

async function buscarFuncionarios(): Promise<{ lista: Funcionario[] } | { erro: string }> {
  if (!variaveisConfiguradas()) {
    return { erro: "O banco de dados não está configurado. Veja a página Início." };
  }
  const { data, error } = await supabase()
    .from("funcionarios")
    .select("id, nome, funcao, telefone, cpf, ativo")
    .order("nome");
  if (error) return { erro: mensagemDeErro(error) };
  return { lista: data ?? [] };
}

export default function Equipe() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const resultado = await buscarFuncionarios();
    if ("erro" in resultado) setErro(resultado.erro);
    else {
      setFuncionarios(resultado.lista);
      setErro(null);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    let cancelado = false;
    buscarFuncionarios().then((resultado) => {
      if (cancelado) return;
      if ("erro" in resultado) setErro(resultado.erro);
      else setFuncionarios(resultado.lista);
      setCarregando(false);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const ativos = funcionarios.filter((f) => f.ativo);
  const inativos = funcionarios.filter((f) => !f.ativo);

  // Funções padrão + as que já existem no banco
  const funcoes = useMemo(() => {
    const todas = new Set(FUNCOES_PADRAO);
    funcionarios.forEach((f) => todas.add(f.funcao));
    return Array.from(todas).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [funcionarios]);

  function abrirNovo() {
    setFormulario(FORMULARIO_VAZIO);
  }

  function abrirEdicao(f: Funcionario) {
    setFormulario({ id: f.id, nome: f.nome, funcao: f.funcao, telefone: f.telefone ?? "" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!formulario) return;
    const nome = formulario.nome.trim();
    const funcao = formulario.funcao.trim();
    if (!nome || !funcao) {
      alert("Preencha o nome e a função.");
      return;
    }
    const dados = { nome, funcao, telefone: formulario.telefone.trim() || null };
    setSalvando(true);
    const db = supabase().from("funcionarios");
    const { error } = formulario.id
      ? await db.update(dados).eq("id", formulario.id)
      : await db.insert(dados);
    setSalvando(false);
    if (error) {
      alert("Não foi possível salvar: " + mensagemDeErro(error));
      return;
    }
    setFormulario(null);
    carregar();
  }

  async function mudarAtivo(f: Funcionario, ativo: boolean) {
    if (!ativo && !confirm(`Desativar ${f.nome}? A pessoa sai da escala, mas não é apagada.`)) {
      return;
    }
    const { error } = await supabase().from("funcionarios").update({ ativo }).eq("id", f.id);
    if (error) {
      alert("Não foi possível alterar: " + mensagemDeErro(error));
      return;
    }
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipe</h1>
        <button type="button" className="botao w-full sm:w-auto" onClick={abrirNovo}>
          + Adicionar funcionário
        </button>
      </div>

      {carregando && <p className="text-neutral-600">Carregando...</p>}
      {erro && <p className="cartao text-red-700">Erro: {erro}</p>}

      {!carregando && !erro && ativos.length === 0 && (
        <p className="cartao text-neutral-600">Nenhum funcionário ativo cadastrado.</p>
      )}

      <ul className="space-y-3">
        {ativos.map((f) => (
          <li key={f.id} className="cartao">
            <CartaoFuncionario funcionario={f} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="botao-secundario" onClick={() => abrirEdicao(f)}>
                Editar
              </button>
              <button
                type="button"
                className="botao-secundario !border-neutral-400 !text-neutral-700"
                onClick={() => mudarAtivo(f, false)}
              >
                Desativar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {inativos.length > 0 && (
        <section className="space-y-3 pt-4">
          <h2 className="text-lg font-semibold text-neutral-600">Desativados</h2>
          <ul className="space-y-3">
            {inativos.map((f) => (
              <li key={f.id} className="cartao opacity-70">
                <CartaoFuncionario funcionario={f} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className="botao-secundario" onClick={() => abrirEdicao(f)}>
                    Editar
                  </button>
                  <button type="button" className="botao" onClick={() => mudarAtivo(f, true)}>
                    Reativar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {formulario && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
          <form
            onSubmit={salvar}
            className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
          >
            <h2 className="text-xl font-bold">
              {formulario.id ? "Editar funcionário" : "Novo funcionário"}
            </h2>
            <label className="block space-y-1">
              <span className="font-semibold">Nome</span>
              <input
                className="campo"
                value={formulario.nome}
                onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
                autoFocus
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold">Função</span>
              <select
                className="campo"
                value={formulario.funcao}
                onChange={(e) => setFormulario({ ...formulario, funcao: e.target.value })}
                required
              >
                <option value="">Escolha a função</option>
                {funcoes.map((funcao) => (
                  <option key={funcao} value={funcao}>
                    {funcao}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="font-semibold">Telefone</span>
              <input
                className="campo"
                type="tel"
                inputMode="tel"
                placeholder="(00) 90000-0000"
                value={formulario.telefone}
                onChange={(e) => setFormulario({ ...formulario, telefone: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                className="botao-secundario"
                onClick={() => setFormulario(null)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button type="submit" className="botao" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function CartaoFuncionario({ funcionario }: { funcionario: Funcionario }) {
  return (
    <div>
      <p className="text-lg font-bold">{funcionario.nome}</p>
      <p className="text-neutral-700">
        <span
          className="mr-2 inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold text-white"
          style={{ background: "var(--cor-destaque)" }}
        >
          {funcionario.funcao}
        </span>
        {funcionario.telefone ? (
          <a href={`tel:${funcionario.telefone.replace(/\D/g, "")}`} className="underline">
            {funcionario.telefone}
          </a>
        ) : (
          <span className="text-neutral-500">Sem telefone</span>
        )}
      </p>
    </div>
  );
}
